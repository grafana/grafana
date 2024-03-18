package sqlstash

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jonboulle/clockwork"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrPgNotPostgresDriver = errors.New("expecting postgres driver")
	ErrPgConnClosed        = errors.New("postgres connection closed")
)

type postgresListenNotifyWatcher struct {
	log *log.ConcreteLogger
	l   *pgListener
}

type postgresListenNotifyWatcherParams struct {
	cfg  *setting.Cfg
	sess *session.SessionDB
	log  *log.ConcreteLogger
}

func newPostgresListenNotifyWatcher(ctx context.Context, params postgresListenNotifyWatcherParams) (postgresListenNotifyWatcher, error) {
	var zero postgresListenNotifyWatcher
	connString, err := pgConnStringFromCfg(params.cfg)
	if err != nil {
		return zero, fmt.Errorf("get postgres connstring from cfg: %w", err)
	}

	listenerParams := pgListenerParams{
		ConnString: connString,
	}
	l, err := newPgListener(ctx, listenerParams)
	if err != nil {
		return zero, fmt.Errorf("create postgres listener: %w", err)
	}

	if err = l.Listen(ctx, migrator.PostgresUnifiedStorageChannel); err != nil {
		return zero, fmt.Errorf("listen to postgres channel %q: %w",
			migrator.PostgresUnifiedStorageChannel, err)
	}

	return postgresListenNotifyWatcher{
		log: params.log,
		l:   l,
	}, nil
}

func (w postgresListenNotifyWatcher) start(ctx context.Context, stream chan<- *entity.Entity) {
	defer func() {
		if err := w.l.Close(context.Background()); err != nil {
			w.log.Error("close connection", "err", err)
		}
		close(stream)
	}()

	for {
		select {
		case <-ctx.Done():
			return

		case n := <-w.l.NotificationsChan():
			w.log.Debug("received postgres notification", "notification", n)

			var result pgNotificationPayload
			err := json.NewDecoder(strings.NewReader(n.Payload)).Decode(&result)
			if err != nil {
				w.log.Error("decode postgres notification JSON payload",
					"error", err, "notification", n)
				continue
			}

			w.log.Debug("sending postgres notification result", "notification",
				n, "entity", result)
			stream <- result.toEntity()
		}
	}
}

type pgNotificationPayload struct {
	ETag            string                                  `json:"ETag"`
	Action          int64                                   `json:"action"`
	Body            pgJSONBytes                             `json:"body"`
	CreatedAt       int64                                   `json:"created_at"`
	CreatedBy       string                                  `json:"created_by"`
	Description     string                                  `json:"description"`
	Errors          jsonEmbedded[[]*entity.EntityErrorInfo] `json:"errors"`
	Fields          jsonEmbedded[map[string]string]         `json:"fields"`
	Folder          string                                  `json:"folder"`
	Group           string                                  `json:"group"`
	GroupVersion    string                                  `json:"group_version"`
	Guid            string                                  `json:"guid"`
	Key             string                                  `json:"key"`
	Labels          jsonEmbedded[map[string]string]         `json:"labels"`
	Message         string                                  `json:"message"`
	Meta            pgJSONBytes                             `json:"meta"`
	Name            string                                  `json:"name"`
	Namespace       string                                  `json:"namespace"`
	Origin          *jsonEmbedded[entity.EntityOriginInfo]  `json:"origin"`
	Resource        string                                  `json:"resource"`
	ResourceVersion int64                                   `json:"resource_version"`
	Size            int64                                   `json:"size"`
	Slug            string                                  `json:"slug"`
	Status          pgJSONBytes                             `json:"status"`
	Subresource     string                                  `json:"subresource"`
	Title           string                                  `json:"title"`
	UpdatedAt       int64                                   `json:"updated_at"`
	UpdatedBy       string                                  `json:"updated_by"`
}

func (e *pgNotificationPayload) toEntity() *entity.Entity {
	ret := entity.Entity{
		ETag:            e.ETag,
		Action:          entity.Entity_Action(e.Action),
		Body:            e.Body,
		CreatedAt:       e.CreatedAt,
		CreatedBy:       e.CreatedBy,
		Description:     e.Description,
		Errors:          e.Errors.Value,
		Fields:          e.Fields.Value,
		Folder:          e.Folder,
		Group:           e.Group,
		GroupVersion:    e.GroupVersion,
		Guid:            e.Guid,
		Key:             e.Key,
		Labels:          e.Labels.Value,
		Message:         e.Message,
		Meta:            e.Meta,
		Name:            e.Name,
		Namespace:       e.Namespace,
		Resource:        e.Resource,
		ResourceVersion: e.ResourceVersion,
		Size:            e.Size,
		Slug:            e.Slug,
		Status:          e.Status,
		Subresource:     e.Subresource,
		Title:           e.Title,
		UpdatedAt:       e.UpdatedAt,
		UpdatedBy:       e.UpdatedBy,
	}

	if e.Origin != nil {
		ret.Origin = &e.Origin.Value
	}

	return &ret
}

var (
	bJSONEmptyString = []byte(`""`)
	bJSONNullString  = []byte(`"null"`)
	bJSONNull        = []byte(`null`)
)

func skipDecodeJSON(b []byte) bool {
	return slices.Equal(b, bJSONEmptyString) ||
		slices.Equal(b, bJSONNullString) ||
		slices.Equal(b, bJSONNull)
}

type jsonEmbedded[T any] struct {
	Value T
}

func (x *jsonEmbedded[T]) UnmarshalJSON(b []byte) error {
	if skipDecodeJSON(b) {
		return nil
	}

	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("decode string: %w", err)
	}

	err := json.NewDecoder(strings.NewReader(s)).Decode(&x.Value)
	if err != nil {
		return fmt.Errorf("decode %T: %w", x.Value, err)
	}

	return nil
}

type pgJSONBytes []byte

func (x *pgJSONBytes) UnmarshalJSON(b []byte) error {
	if skipDecodeJSON(b) {
		return nil
	}

	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("decode string: %w", err)
	}

	*x = make([]byte, len(s))
	copy(*x, s)

	return nil
}

// pgConnStringFromCfg returns the connstring for postgres. If there's no config
// for postgres, it returns an error.
func pgConnStringFromCfg(cfg *setting.Cfg) (string, error) {
	// copied from (*pkg/services/store/entity/db/dbimpl.EntityDB).GetEngine

	cfgSection := cfg.SectionWithEnvOverrides("entity_api")

	dbType := cfgSection.Key("db_type").MustString("")
	if dbType != migrator.Postgres {
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
		"user=%s password=%s host=%s port=%s dbname=%s sslmode=%s",
		dbUser, dbPass, addr.Host, addr.Port, dbName, dbSslMode,
	)

	return connString, nil
}

// pgxConn allows mocking *pgx.Conn for unit testing.
type pgxConn interface {
	Ping(ctx context.Context) error
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Close(ctx context.Context) error
}

// pgListenerParams is used to create a new pgListener. It has few mandatory
// fields, which are clearly identified, with most having safe defaults.
type pgListenerParams struct {
	// ConnString is mandatory, and is the connection string that will be used
	// to connect to the postgres server.
	ConnString string

	// BufferLenHint is optional and defaults to 32. It is a hint on how much
	// spare space we want to have ready to buffer incoming notifications that
	// cannot be immediately processed. This is just a hint, as more space will
	// be automatically allocated to accommodate for spiky traffic. When traffic
	// normilizes, the buffer will also shrink to release unused memory and
	// gravitate towards the BufferLenHint back again.
	BufferLenHint int

	// PingTimeout is optional and defaults to 1 second. It is the timeout that
	// will be used for pinging the server when the listener is ready to accept
	// more work.
	PingTimeout time.Duration

	// PingTick is optional and defaults to 100ms. It is the approximate maximum
	// time that the connection will be idle before sending a new ping to check
	// for new work.
	PingTick time.Duration

	// ConnectConfig is optional and defaults to using pgx.ConnectConfig. It
	// allows mocking a real connection for unit testing purposes.
	ConnectConfig func(ctx context.Context, connConfig *pgx.ConnConfig) (pgxConn, error)

	// Clock is optional and defaults to clockwork.NewRealClock(), and this can
	// be changed mock all time operations in tests.
	clockwork.Clock
}

// WithDefaults sets safe defaults on the given configuration. It will be called
// by newPgListener.
func (p pgListenerParams) WithDefaults() pgListenerParams {
	// set defaults where possible
	const (
		defaultBufferLenHint = 32
		defaultPintTimeout   = time.Second
		defaultPingTick      = 100 * time.Millisecond
	)
	p.BufferLenHint = cmp.Or(p.BufferLenHint, defaultBufferLenHint)
	p.PingTimeout = cmp.Or(p.PingTimeout, defaultPintTimeout)
	p.PingTick = cmp.Or(p.PingTick, defaultPingTick)
	if p.Clock == nil {
		p.Clock = clockwork.NewRealClock()
	}
	if p.ConnectConfig == nil {
		p.ConnectConfig = func(ctx context.Context, connConfig *pgx.ConnConfig) (pgxConn, error) {
			return pgx.ConnectConfig(ctx, connConfig)
		}
	}

	return p
}

// pgListener provides a clear and concise API to work with PostgreSQL
// LISTEN/NOTIFY. It establishes a dedicated connection to a postgres server and
// streams all notifications through a channel.
type pgListener struct {
	nchan           chan *pgconn.Notification
	nchanAllowWrite bool
	nchanWriteMu    sync.Mutex

	// *pgx.Conn is not safe for concurrent use, so we synchronize execution to
	// it with a channel. It can be done with a mutex as well, but in case
	// nothing is executing we will be pinging the server
	execChan   chan func(pgxConn)
	connClosed chan struct{}

	// listenedChannels should only be accessed within the exec goroutine
	// launched in newPgListener (which includes funcs passed to
	// execChan)
	listenedChannels map[string]struct{}
}

func newPgListener(ctx context.Context, params pgListenerParams) (*pgListener, error) {
	params = params.WithDefaults()

	connConfig, err := pgx.ParseConfig(params.ConnString)
	if err != nil {
		return nil, fmt.Errorf("parse postgres connstring: %w", err)
	}

	l := &pgListener{
		nchan:            make(chan *pgconn.Notification),
		nchanAllowWrite:  true,
		execChan:         make(chan func(pgxConn)),
		connClosed:       make(chan struct{}),
		listenedChannels: map[string]struct{}{},
	}

	// register the handler for notifications
	connConfig.OnNotification = l.onNotification

	// connect and make the first ping to assess it works correctly
	conn, err := pgx.ConnectConfig(ctx, connConfig)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}

	if err = conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("test ping postgres after conn: %w; connection"+
			" close err: %w", err, conn.Close(ctx))
	}

	go l.run(params, conn)

	return l, nil
}

func (l *pgListener) onNotification(_ *pgconn.PgConn, n *pgconn.Notification) {
	if n == nil {
		return
	}

	l.nchanWriteMu.Lock()
	defer l.nchanWriteMu.Unlock()

	if !l.nchanAllowWrite {
		// connection was closed already, drop notification
		return
	}

	// try to send the notification unless the connection is closed
	select {
	case <-l.connClosed:
	case l.nchan <- n:
	}
}

func (l *pgListener) run(params pgListenerParams, conn *pgx.Conn) {
	ticker := params.Clock.NewTicker(params.PingTick)
	defer func() {
		ticker.Stop()

		// we close nchan here because this is running in a loop listening
		// for connection close. If we try to close the channel in the
		// notifications handler there is no guarantee that a notification
		// will arrive on time to let it close the channel. And we do need
		// to close this channel to let consumers know we have finished.
		l.nchanWriteMu.Lock()
		defer l.nchanWriteMu.Unlock()
		close(l.nchan)
		l.nchanAllowWrite = false
	}()

	for {
		// only check for new work if we are listening to at least one
		// channel
		if len(l.listenedChannels) > 0 {
			ticker.Reset(params.PingTick)
		} else {
			ticker.Stop()
		}

		select {
		case <-l.connClosed:
			return

		case f := <-l.execChan:
			f(conn)

		case <-ticker.Chan():
			// backpressure signal to the server indicating we're ready to
			// accept new work. This should typically be a permanent ping,
			// which is light on client-side, light on network traffic and
			// light on server-side as well. The server only needs to check
			// if there are new messages for us when we're ready to accept
			// them.
			ctx, cancel := context.WithTimeout(context.Background(), params.PingTimeout)
			if err := conn.Ping(ctx); err != nil {
				// TODO: log the error and add a metric
			}
			cancel()
		}

	}
}

// NotificationsChan returns the channel which will provide the stream of
// postgres notifications.
func (l *pgListener) NotificationsChan() <-chan *pgconn.Notification {
	return l.nchan
}

// exec provides protected access to the internal connection to execute SQL
// commands on it. Callers should not hold references to the connection. This
// is an internal utility method, you should not run custom SQL on this
// connection.
func (l *pgListener) exec(f func(pgxConn)) (connClosed bool) {
	select {
	case l.execChan <- f:
		return false
	case <-l.connClosed:
		return true
	}
}

// Listen makes the managed connection to start listening to the given channel.
// If that channel was already being listened for, it's a nop.
func (l *pgListener) Listen(ctx context.Context, channelName string) error {
	var err error
	connClosed := l.exec(func(conn pgxConn) {
		if l.listenedChannels == nil {
			l.listenedChannels = map[string]struct{}{}
		} else if _, ok := l.listenedChannels[channelName]; ok {
			return
		}

		_, err = conn.Exec(ctx, "LISTEN "+pgEscapeIdentifier(channelName))
		if err == nil {
			l.listenedChannels[channelName] = struct{}{}
		}
	})

	if connClosed {
		return ErrPgConnClosed
	}

	return err
}

// Unlisten makes the managed connection to stop listening to the given channel.
// If that channel was not being listened for, it's a nop.
func (l *pgListener) Unlisten(ctx context.Context, channelName string) error {
	var err error
	connClosed := l.exec(func(conn pgxConn) {
		if l.listenedChannels == nil {
			return
		} else if _, ok := l.listenedChannels[channelName]; !ok {
			return
		}

		_, err = conn.Exec(ctx, "UNLISTEN "+pgEscapeIdentifier(channelName))
		if err == nil {
			delete(l.listenedChannels, channelName)
		}
	})

	if connClosed {
		return ErrPgConnClosed
	}

	return err
}

// Close closes the connection and relases all associated resources.
func (l *pgListener) Close(ctx context.Context) error {
	var err error
	connClosed := l.exec(func(conn pgxConn) {
		close(l.connClosed)
		clear(l.listenedChannels)
		err = conn.Close(ctx)
	})

	if connClosed {
		return ErrPgConnClosed
	}

	return err
}

// pgEscapeIdentifier escapes an identifier. If the identifier is qualified,
// e.g. schema.table, then pass "schema" and "table" as separate arguments. The
// result is a single string which is safe to be interpolated directly in code.
func pgEscapeIdentifier(s ...string) string {
	return pgx.Identifier(s).Sanitize()
}
