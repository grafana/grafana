package sqlstash

import (
	"context"
	"time"

	"github.com/bwmarrin/snowflake"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type pollWatcher struct {
	log       log.Logger
	dialect   migrator.Dialect
	sess      *session.SessionDB
	snowflake *snowflake.Node
}

func (w pollWatcher) start(ctx context.Context, stream chan<- *entity.Entity) {
	defer close(stream)

	var err error
	since := w.snowflake.Generate().Int64()

	t := time.NewTicker(5 * time.Second)
	defer t.Stop()

	for range t.C {
		since, err = w.poll(ctx, since, stream)
		if ctx.Err() != nil {
			// don't show an error if context done, just terminate
			return
		}
		if err != nil {
			w.log.Error("poll error", "err", err)
		}
	}
}

func (w pollWatcher) poll(ctx context.Context, since int64, out chan<- *entity.Entity) (int64, error) {
	rr := fieldSelectRequest{
		withBody:   true,
		withStatus: true,
	}

	fields := getReadFields(rr)

	for hasmore := true; hasmore; {
		err := func() error {
			entityQuery := selectQuery{
				dialect: w.dialect,
				fields:  fields,
				from:    "entity_history", // the table
				args:    []any{},
				limit:   100, // r.Limit,
				// offset:   0,
				oneExtra: true, // request one more than the limit (and show next token if it exists)
				orderBy:  []string{"resource_version"},
			}

			entityQuery.addWhere("resource_version > ?", since)

			query, args := entityQuery.toQuery()

			rows, err := w.sess.Query(ctx, query, args...)
			if err != nil {
				return err
			}
			defer func() { _ = rows.Close() }()

			found := int64(0)
			for rows.Next() {
				found++
				if found > entityQuery.limit {
					return nil
				}

				result, err := rowToEntity(rows, rr)
				if err != nil {
					return err
				}

				if result.ResourceVersion > since {
					since = result.ResourceVersion
				}

				w.log.Debug("sending poll result", "guid", result.Guid, "action", result.Action, "rv", result.ResourceVersion)
				out <- result
			}

			hasmore = false
			return nil
		}()
		if err != nil {
			return since, err
		}
	}

	return since, nil
}
