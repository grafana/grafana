package sqlstash

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util"
)

// Package level constants.
const (
	DefaultPgWatcherChannelBufferLen = 16
)

// Package level errors.
var (
	ErrPgNotPostgresDriver = errors.New("expecting postgres driver")
	ErrPgListenerNotInit   = errors.New("postgres listener not initialized")
	ErrPgWatchTerminated   = errors.New("watch operation terminated by the administrator")
	ErrPgInvalidChanName   = errors.New("invalid postgres channel name")
)

// Types aliases that serve to provide consistent namning and documentation throughout postgres LISTEN/NOTIFY
// implementation for the Watch method of entity.EntityStoreServer.
type (
	// pgWatcherChannel is a channel of postgres notifications. These channels are created by watchers and registered by
	// pgAddNotifyChan. Watchers only receive from them, then the broker sends to them, and finally pgRemoveNotifyChan
	// closes them.
	pgWatcherChannel = chan<- *pgconn.Notification

	// pgWatcherChannelMap could be better expressed as a map[pgWatcherChannel]struct{}, except for the fact that
	// pgWatcherChannel is a channel type, hence it's not comparable and cannot be used as a map key. We could use
	// anything, like a random UUID, as the key, but we chose to use a pointer type because it's far more trivial and
	// provides an even stronger against collisions, since a new allocation will provide a unique address, and all we
	// care for here is uniqueness at the server process level. Note that we cannot use something like *struct{} since
	// the Go compiler optimizes all *struct{} to point to the same address, so we need to choose something else.
	pgWatcherChannelMapKey = *byte
	pgWatcherChannelMap    = map[pgWatcherChannelMapKey]pgWatcherChannel

	// pgChannel is a postgres channel identifier, which is used to call the postgres LISTEN SQL command on it to
	// receive notifications of changes to "entity" table. These notifications are created by a trigger on that table
	// that calls the postgres NOTIFY SQL command, and include a payload JSON payload that we decode on this side.
	pgChannel = string

	// pgChannelMap holds a reference to all watcher channels. As we could receive multiple Watch requests for the same
	// channel (which we map to a k8s namespace, which in turn we map to a Grafana tenant), then we use each of these
	// pgWatcherChannel to provide the appropriate notifications to each client served.
	pgChannelMap = map[pgChannel]pgWatcherChannelMap
)

// makeUnboundedQueuedChans creates a receive only and a send only channels, which hold a variable length buffer between
// them. We use this to prevent dropping any postgres async notifications.
func makeUnboundedQueuedChans[T any](initBuf int) (in chan<- T, out <-chan T) {
	inChan := make(chan T)
	outChan := make(chan T)

	go func() {
		var zero T
		var q []T

		if initBuf != 0 {
			q = make([]T, 0, initBuf)
		}

		getOutChan := func() chan T {
			if len(q) == 0 {
				return nil // block forever in the select, hence wait for inChan
			}
			return outChan
		}

		getCurVal := func() T {
			if len(q) == 0 {
				return zero // nop for when we block forever
			}
			return q[0]
		}

		for len(q) > 0 || inChan != nil {
			select {
			case v, ok := <-inChan:
				if !ok {
					inChan = nil
				} else {
					q = append(q, v)
				}
			case getOutChan() <- getCurVal():
				copy(q, q[1:])     // shift queue left
				q[len(q)-1] = zero // zero-out last value (necessary por pointer types)
				q = q[:len(q)-1]   // remove last element, allowing reuse of allocated space
			}
		}

		close(outChan)
	}()

	return inChan, outChan
}

// pgNotifiedEntity holds the JSON payload that the postgres notification payload contains, and it is used to discard
// uninteresting rows. The JSON payload is built in a trigger on "entity" table, and passed to the postgres NOTIFY
// command so we receive it here.
type pgNotifiedEntity struct {
	GUID string `json:"guid"` // Used to retrieve the full row from "entity_history" by its primary key

	// Fields used to discriminate (un)interesting notifications
	Group           string `json:"group"`
	Name            string `json:"name"`
	Resource        string `json:"resource"`
	ResourceVersion string `json:"resource_version"`
	Folder          string `json:"folder"`
	Labels          string `json:"labels"`
}

// toEntity converts the payload from an entity notification to a partially populated *entity.Entity, enough to be able
// to call watchMatches on it.
func (ne pgNotifiedEntity) toEntity(namespace string) (*entity.Entity, error) {
	ret := &entity.Entity{
		Guid:      ne.GUID,
		Group:     ne.Group,
		Name:      ne.Name,
		Resource:  ne.Resource,
		Namespace: namespace,
		Folder:    ne.Folder,
	}

	v, err := strconv.ParseInt(ne.ResourceVersion, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("decode resource version: %w", err)
	}
	ret.ResourceVersion = v

	// unmarshal json labels
	if ne.Labels != "" {
		if err := json.NewDecoder(strings.NewReader(ne.Labels)).Decode(&ret.Labels); err != nil {
			return nil, fmt.Errorf("decode labels: %w", err)
		}
	}

	return ret, nil
}

// pgTerminateWatch closes the connection used for postgres notifications, terminates all watchers and resets the
// state to be ready again for new watchers. Current watchers will return ErrPgWatchTerminated error.
func (s *sqlEntityServer) pgTerminateWatch(ctx context.Context) error {
	s.pgListenerConnMu.Lock()
	defer s.pgListenerConnMu.Unlock()
	if s.pgListenerConn == nil {
		return ErrPgListenerNotInit
	}

	// terminate all watchers and the connection
	s.pgTerminateWatchers(ctx)
	err := s.pgListenerConn.Close(ctx)

	// terminate and wait until the broker goroutine has completed
	s.terminateBroker()
	<-s.pgBrokerDone

	// cleanup
	s.pgListenerConn = nil
	s.terminateBroker = nil
	s.pgBrokerDone = nil

	return err
}

func (s *sqlEntityServer) pgGetConnString() (string, error) {
	// copied from (*pkg/services/store/entity/db/dbimpl.EntityDB).GetEngine

	cfgSection := s.db.GetCfg().SectionWithEnvOverrides("entity_api")

	if dbType := cfgSection.Key("db_type").MustString(""); dbType != migrator.Postgres {
		return "", fmt.Errorf("invalid database type %q: %w", dbType, ErrPgNotPostgresDriver)
	}

	dbHost := cfgSection.Key("db_host").MustString("")
	dbName := cfgSection.Key("db_name").MustString("")
	dbUser := cfgSection.Key("db_user").MustString("")
	dbPass := cfgSection.Key("db_pass").MustString("")

	// TODO: support all postgres connection options
	dbSslMode := cfgSection.Key("db_sslmode").MustString("disable")

	addr, err := util.SplitHostPortDefault(dbHost, "127.0.0.1", "5432")
	if err != nil {
		return "", fmt.Errorf("invalid host specifier '%s': %w", dbHost, err)
	}

	connString := fmt.Sprintf(
		"user=%s password=%s host=%s port=%s dbname=%s sslmode=%s", // sslcert=%s sslkey=%s sslrootcert=%s",
		dbUser, dbPass, addr.Host, addr.Port, dbName, dbSslMode, // ss.dbCfg.ClientCertPath, ss.dbCfg.ClientKeyPath, ss.dbCfg.CaCertPath
	)

	return connString, nil
}

func (s *sqlEntityServer) pgNewConn(ctx context.Context, notificationHandler pgconn.NotificationHandler) (*pgx.Conn, error) {
	connString, err := s.pgGetConnString()
	if err != nil {
		return nil, fmt.Errorf("get postgres connection string: %w", err)
	}

	connConfig, err := pgx.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("parse postgres config: %w", err)
	}
	connConfig.OnNotification = notificationHandler

	conn, err := pgx.ConnectConfig(ctx, connConfig)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}
	if err = conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres after initial connection: %w", err)
	}

	return conn, nil
}

// pgExecListenerConn returns the *pgx.Conn used for postgres notifications, initializing it if necessary.
func (s *sqlEntityServer) pgExecListenerConn(ctx context.Context, f func(*pgx.Conn) error) error {
	s.pgListenerConnMu.RLock()
	conn := s.pgListenerConn
	s.pgListenerConnMu.RUnlock()

	if conn != nil {
		return f(conn)
	}

	// initialize

	s.pgListenerConnMu.Lock()
	defer s.pgListenerConnMu.Unlock()

	if conn != nil {
		// check again since we have a critical section gap above
		return f(conn)
	}

	var inMu sync.RWMutex
	in, out := makeUnboundedQueuedChans[*pgconn.Notification](s.pgWatcherChannelBufferLen)
	s.terminateBroker = func() {
		inMu.Lock()
		defer inMu.Unlock()
		close(in)
		in = nil
	}

	conn, err := s.pgNewConn(ctx, func(_ *pgconn.PgConn, n *pgconn.Notification) {
		if n == nil {
			return
		}

		inMu.RLock()
		defer inMu.RUnlock()
		if in != nil {
			in <- n
		}
	})
	if err != nil {
		return fmt.Errorf("get new postgres listener connection: %w", err)
	}

	pgBrokerDone := make(chan struct{})
	s.pgListenerConn = conn
	s.pgBrokerDone = pgBrokerDone

	go s.pgNotificationBroker(out, pgBrokerDone)

	return f(conn)
}

// pgLogListeningChannels can be used to confirm which channels are we listening on, as seen from the server side.
// Useful for debugging only.
func (s *sqlEntityServer) pgLogListeningChannels(ctx context.Context) {
	err := s.pgExecListenerConn(ctx, func(conn *pgx.Conn) error {
		var chans []string
		rows, err := conn.Query(ctx, "SELECT pg_listening_channels()")
		if err != nil {
			return fmt.Errorf("postgres query listening channels: %w", err)
		}

		for rows.Next() {
			var s string
			if err = rows.Scan(&s); err != nil {
				return fmt.Errorf("postgres query listening channels scan row error: %w", err)
			}
			chans = append(chans, s)
		}
		s.log.Info("postgres listening chans", "count", len(chans), "channels", chans)

		return nil
	})
	if err != nil {
		s.log.Error("postgres log listening channels", "error", err)
	}
}

// pgAddNotifyChan registers the given Go channel for the postgres notification broker to direct relevant notifications to
// it. The pointer it returns is used as an ID (or handle) to remove the channel with pgRemoveNotifyChan when the calling
// function no longer needs to receive notifications. The postgres channel name is the k8s namespace, and is directly
// associated with the tenant id.
func (s *sqlEntityServer) pgAddNotifyChan(ctx context.Context, pgChannelName string, c chan<- *pgconn.Notification) (pgWatcherChannelMapKey, error) {
	s.pgNotifyMapMu.Lock()
	defer s.pgNotifyMapMu.Unlock()

	// we need to properly escape the postgres channel name as a postgres identifier
	if pgChannelName == "" {
		return nil, fmt.Errorf("empty postgres channel name %q: %w", pgChannelName, ErrPgInvalidChanName)
	}

	if s.pgNotifyMap == nil {
		s.pgNotifyMap = pgChannelMap{}
	}
	if _, ok := s.pgNotifyMap[pgChannelName]; !ok {
		s.pgNotifyMap[pgChannelName] = pgWatcherChannelMap{}
		// we weren't listening before, so we start listening
		err := s.pgExecListenerConn(ctx, func(conn *pgx.Conn) error {
			escapedPgChannelName := ((pgx.Identifier)([]string{pgChannelName})).Sanitize()
			_, err := conn.Exec(ctx, "LISTEN "+escapedPgChannelName)
			return err
		})
		if err != nil {
			return nil, fmt.Errorf("pg listen on channel %q: %w", pgChannelName, err)
		}
	}

	watcherKey := new(byte)
	s.pgNotifyMap[pgChannelName][watcherKey] = c

	return watcherKey, nil
}

// pgRemoveNotifyChan removes the channel associated with the given id (or handle). If either the pgChannelName or
// watcherKey are registered it becomes a nop.
func (s *sqlEntityServer) pgRemoveNotifyChan(ctx context.Context, pgChannelName string, watcherKey pgWatcherChannelMapKey) error {
	s.pgNotifyMapMu.Lock()
	defer s.pgNotifyMapMu.Unlock()

	if pgChannelName == "" {
		return nil
	}

	return s.pgRemoveNotifyChanLocked(ctx, pgChannelName, watcherKey)
}

func (s *sqlEntityServer) pgRemoveNotifyChanLocked(ctx context.Context, pgChannelName string, watcherKey pgWatcherChannelMapKey) error {
	if s.pgNotifyMap == nil {
		return nil
	}

	// close the watcher channel and delete the entry from watcher channel map
	m := s.pgNotifyMap[pgChannelName]
	if m == nil {
		return nil
	}

	c := m[watcherKey]
	if c == nil {
		return nil
	}
	close(c)
	delete(m, watcherKey)

	// if the watcher channel map no longer has items, unlisten from that postgres channel and remove the entry from the
	// postgres channel map
	if len(m) == 0 {
		delete(s.pgNotifyMap, pgChannelName)
		err := s.pgExecListenerConn(ctx, func(conn *pgx.Conn) error {
			escapedPgChannelName := ((pgx.Identifier)([]string{pgChannelName})).Sanitize()
			_, err := conn.Exec(ctx, "UNLISTEN "+escapedPgChannelName)
			return err
		})
		if err != nil {
			return fmt.Errorf("pg unlisten on channel %q: %w", pgChannelName, err)
		}
	}

	return nil
}

// pgTerminateWatchers manually terminates all watchers, unlistens from all postgres channels and performs local state
// cleanup, but doesn't terminate the dedicated postgres listener connection. Current watchers will return
// ErrPgWatchTerminated error.
func (s *sqlEntityServer) pgTerminateWatchers(ctx context.Context) {
	s.pgNotifyMapMu.Lock()
	defer s.pgNotifyMapMu.Unlock()
	for pgChannelName, m := range s.pgNotifyMap {
		for k := range m {
			if err := s.pgRemoveNotifyChanLocked(ctx, pgChannelName, k); err != nil {
				s.log.Error("terminate all postgres watchers: %w", err)
			}
		}
	}
}

// pgNotificationBroker processes all the postgres server notifications sent to this server instance. As we use a
// single DB connection to handle all postgres notifications, we need this broker to send the notification to the
// appropriate running watcher.
func (s *sqlEntityServer) pgNotificationBroker(notifChan <-chan *pgconn.Notification, pgBrokerDone chan<- struct{}) {
	s.log.Info("starting postgres notifications broker loop")

	t := s.clock.NewTicker(time.Second)
	defer t.Stop()

	// main broker loop
	for ; ; t.Reset(time.Second) {
		select {
		case n, ok := <-notifChan:
			if !ok {
				return
			}
			s.pgNotifyMapMu.RLock()
			for _, c := range s.pgNotifyMap[n.Channel] {
				c <- n
			}
			s.pgNotifyMapMu.RUnlock()

		case <-t.Chan():
			// this only serves to keep the connection warm, since we are using this connection for notifications only.
			// This is a nop, we don't do any work on the server, just make sure the connection is up and healthy. A
			// failed ping will not necessarily mean the connection has finished, but it will be recovered and subsequent
			// pings may succeed.
			// TODO: add a metric for failed pings and alert on permanently failing pings from the same host.
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			err := s.pgExecListenerConn(ctx, func(conn *pgx.Conn) error {
				defer cancel()
				return conn.Ping(ctx)
			})
			if err != nil {
				s.log.Error("postgres listener ping error", "error", err)
			}
		}
	}

	// signal that we have terminated, as this is meant to be run in a differnet goroutine
	close(pgBrokerDone)
	s.log.Info("postgres notifications broker loop terminated")
}

// pgWatch is like watch but uses the native postgres LISTEN/NOTIFY SQL commands, and only queries for the rows we
// are sure we are interested in. Notifications include a payload which aids discriminating which are relevant to a
// watcher.
func (s *sqlEntityServer) pgWatch(ctx context.Context, r cachedEntityWatchRequest, w entity.EntityStore_WatchServer) error {
	// create a channel for the broker to send us the notifications we're interested in and register it
	in, out := makeUnboundedQueuedChans[*pgconn.Notification](s.pgWatcherChannelBufferLen)
	watcherKey, err := s.pgAddNotifyChan(ctx, r.namespace, in)
	if err != nil {
		return err
	}

	// cleanup
	defer func() {
		if err := s.pgRemoveNotifyChan(ctx, r.namespace, watcherKey); err != nil {
			s.log.Error("remove notify channel", "error", err)
		}
	}()

	// main notifications loop
loop:
	for {
		select {
		case <-ctx.Done():
			// NB: if you call `break` within a `select` statement you will break the select, so we need a label to
			// explicitly refer to the loop
			break loop

		case n, ok := <-out:
			if !ok {
				// we were terminated by pgTerminateWatchers
				return ErrPgWatchTerminated
			}

			// decode the notification payload
			var ne pgNotifiedEntity
			if err := json.NewDecoder(strings.NewReader(n.Payload)).Decode(&ne); err != nil {
				s.log.Error("decode postgres notification from channel %q with JSON payload %q: %w", r.namespace, n.Payload, err)
				continue
			}

			// continue if we don't care about this notification
			partialEntity, err := ne.toEntity(r.namespace)
			if err != nil {
				s.log.Error("convert notification with payload %q to entity: %w", n.Payload, err)
				continue
			}
			if !watchMatches(r, partialEntity) {
				continue
			}

			ident := pgx.Identifier{""}
			fields := s.getReadFields(r.WithBody, r.WithStatus)
			for i := range fields {
				ident[0] = fields[i]
				fields[i] = ident.Sanitize()
			}
			query := "SELECT " + strings.Join(fields, ",") + " FROM entity_history WHERE guid = ?"

			// retrieve the full row from the database. We are using Query instead of Get method to reuse rowToEntity
			// for max consistency, but we are sure we cannot get more than one row since the `guid` field is the
			// primary key of the table
			rows, err := s.sess.Query(ctx, query, ne.GUID)
			if err != nil {
				return fmt.Errorf("get from entity history by GUID %q: %w", ne.GUID, err)
			}
			defer rows.Close()

			// advance the rows iterator to retrieve the row
			if !rows.Next() {
				return fmt.Errorf("entity with GUID %q not found in history", ne.GUID)
			}

			// convert the row to entity
			result, err := s.rowToEntity(ctx, rows, r.WithBody, r.WithStatus)
			if err != nil {
				return fmt.Errorf("convert SQL row to entity with GUID %q: %w", ne.GUID, err)
			}

			// send the results to the client
			s.log.Debug("sending watch result", "guid", result.Guid, "action", result.Action)
			err = w.Send(&entity.EntityWatchResponse{
				Timestamp: time.Now().UnixMilli(),
				Entity:    result,
			})
			if err != nil {
				return fmt.Errorf("sending entity with GUID %q to client: %w", ne.GUID, err)
			}

			// update r.Since value so we don't send earlier results again
			r.Since = result.ResourceVersion
		}
	}

	return nil
}
