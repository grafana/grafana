package migrations

import (
	"github.com/go-xorm/xorm"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addEndpointMigration(mg *Migrator) {

	var endpointV1 = Table{
		Name: "endpoint",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create endpoint table v1", NewAddTableMigration(endpointV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", endpointV1)

	slugCol := &Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: true}
	migration := NewAddColumnMigration(endpointV1, slugCol)
	migration.OnSuccess = func(sess *xorm.Session) error {
		sess.Table("endpoint")
		endpoints := make([]m.Endpoint, 0)
		if err := sess.Find(&endpoints); err != nil {
			return err
		}
		for _, e := range endpoints {
			e.UpdateEndpointSlug()
			if _, err := sess.Id(e.Id).Update(e); err != nil {
				return err
			}
		}
		return nil
	}
	mg.AddMigration("add slug column to endpoint v1", migration)

	// add endpoint_tags
	var endpointTagV1 = Table{
		Name: "endpoint_tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "endpoint_id", Type: DB_BigInt, Nullable: false},
			{Name: "tag", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "endpoint_id"}},
			{Cols: []string{"endpoint_id", "tag"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create endpoint_tag table v1", NewAddTableMigration(endpointTagV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", endpointTagV1)

}
