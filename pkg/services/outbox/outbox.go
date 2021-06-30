package outbox

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/grafanats"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("outbox")
)

func init() {
	registry.RegisterService(&Outbox{})
}

// Outbox service,
type Outbox struct {
	Cfg       *setting.Cfg         `inject:""`
	SQLStore  *sqlstore.SQLStore   `inject:""`
	Grafanats *grafanats.Grafanats `inject:""`
}

// Init Outbox.
func (g *Outbox) Init() error {
	logger.Info("Outbox initialization")
	return nil
}

// Run Outbox.
func (g *Outbox) Run(ctx context.Context) error {
loop:
	for {
		select {
		case <-ctx.Done():
			break loop
		case <-time.After(time.Second):
			if !g.Grafanats.IsLeader() {
				continue
			}
			err := g.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
				var event models.OutboxEvent
				ok, err := sess.Where("status = 0").OrderBy("id ASC").ForUpdate().Get(&event)
				if err != nil {
					return err
				}
				if !ok {
					return nil
				}
				pubAck, err := g.Grafanats.Client().Publish(event.Subject, event.Payload)
				if err != nil {
					return err
				}
				logger.Info("published to a stream", "stream", pubAck.Stream, "sequence", pubAck.Sequence)
				event.Status = 1
				_, err = sess.Update(&event)
				return err
			})
			if err != nil {
				logger.Error(err.Error())
			} else {
				err = g.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					_, err := sess.Exec("DELETE FROM outbox_event WHERE status=1")
					return err
				})
				if err != nil {
					logger.Error(err.Error())
				}
			}
		}
	}
	return ctx.Err()
}

// AddMigration defines database migrations.
// This is an implementation of registry.DatabaseMigrator.
func (g *Outbox) AddMigration(mg *migrator.Migrator) {
	if g == nil || g.Cfg == nil {
		return
	}
	addOutboxMigrations(mg)
}

func addOutboxMigrations(mg *migrator.Migrator) {
	outboxEvent := migrator.Table{
		Name: "outbox_event",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "status", Type: migrator.DB_TinyInt, Nullable: false},
			{Name: "subject", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "payload", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{},
	}
	mg.AddMigration("create outbox event table", migrator.NewAddTableMigration(outboxEvent))
}
