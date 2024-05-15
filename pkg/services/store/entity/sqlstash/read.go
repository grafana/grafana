package sqlstash

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
)

func (s *sqlEntityServer) Read(ctx context.Context, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Read")
	defer span.End()
	ctxLogger := s.log.FromContext(log.WithContextualAttributes(ctx, []any{"method", "read"}))

	key, err := entity.ParseKey(r.Key)
	if err != nil {
		ctxLogger.Error("parse entity key", "error", err)
		return nil, fmt.Errorf("parse entity key: %w", err)
	}

	var ret *entity.Entity

	txOpts := &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
		ReadOnly:  true,
	}
	err = s.sqlDB.WithTx(ctx, txOpts, func(_ context.Context, tx db.Tx) error {
		e, err := readEntity(tx, s.sqlDialect, key, r.ResourceVersion, false, false)
		if err != nil {
			return err
		}
		ret = e.Entity

		return nil
	})
	if err != nil {
		ctxLogger.Error("read entity tx", "msg", err.Error())
		return nil, err
	}

	return ret, nil
}
