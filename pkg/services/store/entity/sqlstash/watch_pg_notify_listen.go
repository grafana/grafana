package sqlstash

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

type pgNotifyPayload struct {
	ResourceVersion string `json:"resource_version"`
	Key             string `json:"key"`
}

// pgWatcher is like poller but uses the native postgres LISTEN/NOTIFY SQL commands
func (s *sqlEntityServer) pgWatcher(stream chan *entity.Entity) {
	ctx := context.Background()

	engine, err := s.db.GetEngine()
	if err != nil {
		s.log.Error("error getting engine: %w", err)
		return
	}

	conn, err := engine.DB().DB.Conn(ctx)
	if err != nil {
		s.log.Error("error getting db connection: %w", err)
		return
	}

	defer func() { _ = conn.Close() }()

	err = conn.Raw(func(driverConn any) error {
		dc, ok := driverConn.(driver.Conn)
		if !ok {
			return fmt.Errorf("cannot convert driverConn from %T to driver.Conn", driverConn)
		}

		pq.SetNotificationHandler(dc, func(n *pq.Notification) {
			if n == nil {
				s.log.Debug("received postgres notification", "nil", true)
				return
			}
			s.log.Debug("received postgres notification", "channel", n.Channel, "payload", n.Extra)

			var ne pgNotifyPayload
			if err := json.NewDecoder(strings.NewReader(n.Extra)).Decode(&ne); err != nil {
				s.log.Error("error decoding postgres notification with JSON payload %q: %w", n.Extra, err)
				return
			}

			rv, err := strconv.ParseInt(ne.ResourceVersion, 10, 64)
			if err != nil {
				s.log.Error("error parsing resource version from postgres notification payload %q: %w", n.Extra, err)
				return
			}

			r, err := s.Read(ctx, &entity.ReadEntityRequest{
				Key:             ne.Key,
				ResourceVersion: rv,
				WithBody:        true,
				WithStatus:      true,
			})
			if err != nil {
				s.log.Error("error reading entity for postgres notification payload %q: %w", n.Extra, err)
				return
			}

			stream <- r
		})

		return nil
	})
	if err != nil {
		s.log.Error("error creating new postgres connection: %w", err)
		return
	}

	_, err = conn.ExecContext(ctx, `
create or replace function tgf_notify_entity_history() returns trigger as $BODY$
	begin
		perform pg_notify('unifiedstorage', json_build_object('key', new.key::text, 'resource_version', new.resource_version::text)::text);
		return new;
	end
$BODY$ language plpgsql;

drop trigger if exists tg_notify_entity_history on entity_history;
create trigger tg_notify_entity_history after insert on entity_history for each row execute function tgf_notify_entity_history();

LISTEN unifiedstorage;`)
	if err != nil {
		s.log.Error("error listening to postgres channel: %w", err)
		return
	}

	s.log.Info("watch: postgres LISTEN/NOTIFY connection created successfylly")

	t := time.NewTicker(time.Second)
	defer t.Stop()

loop:
	for ; ; t.Reset(time.Second) {
		select {
		case <-ctx.Done():
			break loop
		case <-t.C:
			// this keeps the connection warm and ensures that we actually get notifications
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			err := conn.PingContext(ctx)
			cancel()
			if err != nil {
				s.log.Error("postgres listener ping error", "error", err)
			}
		}
	}

	_, err = conn.ExecContext(ctx, `UNLISTEN unifiedstorage;`)
	if err != nil {
		s.log.Error("error unlistening to postgres channel: %w", err)
	}

	s.log.Info("watch: postgres LISTEN/NOTIFY connection terminated")
}
