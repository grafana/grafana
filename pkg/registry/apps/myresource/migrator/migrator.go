package migrator

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"text/template"
	"time"

	claims "github.com/grafana/authlib/types"
	myresourcev1beta1 "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

//go:embed query_myresources.sql
var myResourceSQLTemplatesFS embed.FS

var sqlQueryMyResources = template.Must(
	template.New("sql").ParseFS(myResourceSQLTemplatesFS, "query_myresources.sql"),
).Lookup("query_myresources.sql")

type MyResourceMigrator interface {
	MigrateMyResources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// myResourceMigrator handles migrating my resources from legacy SQL storage.
type myResourceMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideMyResourceMigrator creates a myResourceMigrator for use in wire DI.
func ProvideMyResourceMigrator(sql legacysql.LegacyDatabaseProvider) MyResourceMigrator {
	return &myResourceMigrator{sql: sql}
}

// MigrateMyResources handles the my resource migration logic
func (m *myResourceMigrator) MigrateMyResources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating my resources...")
	rows, err := m.ListMyResources(ctx, orgId)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return err
	}

	var id int64
	var orgID int64
	var uid, title, content string
	var ready bool
	var createdBy int64
	var createdAt int64
	var updatedAt int64

	count := 0
	for rows.Next() {
		err = rows.Scan(&id, &orgID, &uid, &title, &content, &ready, &createdBy, &createdAt, &updatedAt)
		if err != nil {
			return err
		}

		myResource := &myresourcev1beta1.MyResource{
			TypeMeta: metav1.TypeMeta{
				APIVersion: myresourcev1beta1.GroupVersion.String(),
				Kind:       "MyResource",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:              uid,
				Namespace:         opts.Namespace,
				CreationTimestamp: metav1.NewTime(time.Unix(createdAt, 0)),
			},
			Spec: myresourcev1beta1.MyResourceSpec{
				Title:   title,
				Content: content,
			},
			Status: myresourcev1beta1.MyResourceStatus{
				Ready: ready,
			},
		}

		if createdBy > 0 {
			myResource.SetCreatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(createdBy, 10)))
		}

		body, err := json.Marshal(myResource)
		if err != nil {
			return err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     myresourcev1beta1.APIGroup,
				Resource:  "myresources",
				Name:      uid,
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(count, fmt.Sprintf("%s (%d)", uid, len(req.Value)))
		count++

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}

	if err = rows.Err(); err != nil {
		return err
	}

	opts.Progress(-2, fmt.Sprintf("finished my resources... (%d)", count))
	return nil
}

func (m *myResourceMigrator) ListMyResources(ctx context.Context, orgID int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newMyResourceQueryReq(helper, &MyResourceQuery{
		OrgID: orgID,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryMyResources, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryMyResources.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}

type MyResourceQuery struct {
	OrgID int64
}

type sqlMyResourceQuery struct {
	sqltemplate.SQLTemplate
	Query *MyResourceQuery

	MyResourceTable string
}

func (r sqlMyResourceQuery) Validate() error {
	return nil
}

func newMyResourceQueryReq(sql *legacysql.LegacyDatabaseHelper, query *MyResourceQuery) sqlMyResourceQuery {
	return sqlMyResourceQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		MyResourceTable: sql.Table("my_resource"),
	}
}
