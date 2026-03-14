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
	shorturlv1beta1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

//go:embed query_shorturls.sql
var shortURLSQLTemplatesFS embed.FS

var sqlQueryShortURLs = template.Must(
	template.New("sql").ParseFS(shortURLSQLTemplatesFS, "query_shorturls.sql"),
).Lookup("query_shorturls.sql")

type ShortURLMigrator interface {
	MigrateShortURLs(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// shortURLMigrator handles migrating short URLs from legacy SQL storage.
type shortURLMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideShortURLMigrator creates a shortURLMigrator for use in wire DI.
func ProvideShortURLMigrator(sql legacysql.LegacyDatabaseProvider) ShortURLMigrator {
	return &shortURLMigrator{sql: sql}
}

// MigrateShortURLs handles the short URL migration logic
func (m *shortURLMigrator) MigrateShortURLs(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating short URLs...")
	rows, err := m.ListShortURLs(ctx, orgId)
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
	var uid, path string
	var createdBy int64
	var createdAt int64
	var lastSeenAt int64

	count := 0
	for rows.Next() {
		err = rows.Scan(&id, &orgID, &uid, &path, &createdBy, &createdAt, &lastSeenAt)
		if err != nil {
			return err
		}

		shortURL := &shorturlv1beta1.ShortURL{
			TypeMeta: metav1.TypeMeta{
				APIVersion: shorturlv1beta1.GroupVersion.String(),
				Kind:       "ShortURL",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:              uid,
				Namespace:         opts.Namespace,
				CreationTimestamp: metav1.NewTime(time.Unix(createdAt, 0)),
			},
			Spec: shorturlv1beta1.ShortURLSpec{
				Path: path,
			},
			Status: shorturlv1beta1.ShortURLStatus{
				LastSeenAt: lastSeenAt,
			},
		}

		if createdBy > 0 {
			shortURL.SetCreatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(createdBy, 10)))
		}

		body, err := json.Marshal(shortURL)
		if err != nil {
			return err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     shorturlv1beta1.APIGroup,
				Resource:  "shorturls",
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

	opts.Progress(-2, fmt.Sprintf("finished short URLs... (%d)", count))
	return nil
}

func (m *shortURLMigrator) ListShortURLs(ctx context.Context, orgID int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newShortURLQueryReq(helper, &ShortURLQuery{
		OrgID: orgID,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryShortURLs, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryShortURLs.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}

type ShortURLQuery struct {
	OrgID int64
}

type sqlShortURLQuery struct {
	sqltemplate.SQLTemplate
	Query *ShortURLQuery

	ShortURLTable string
}

func (r sqlShortURLQuery) Validate() error {
	return nil
}

func newShortURLQueryReq(sql *legacysql.LegacyDatabaseHelper, query *ShortURLQuery) sqlShortURLQuery {
	return sqlShortURLQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		ShortURLTable: sql.Table("short_url"),
	}
}
