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
	sql             legacysql.LegacyDatabaseProvider
	listShortURLsFn func(context.Context, int64, int64, int64) (*sql.Rows, error)
}

// ProvideShortURLMigrator creates a shortURLMigrator for use in wire DI.
func ProvideShortURLMigrator(sql legacysql.LegacyDatabaseProvider) ShortURLMigrator {
	return &shortURLMigrator{sql: sql}
}

// MigrateShortURLs handles the short URL migration logic
func (m *shortURLMigrator) MigrateShortURLs(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating short URLs...")

	var lastID int64 = 0
	limit := int64(1000)
	count := 0
	readDuration := time.Duration(0)
	convertDuration := time.Duration(0)
	writeDuration := time.Duration(0)

	for {
		readStart := time.Now()
		rows, err := m.listShortURLs(ctx, orgId, lastID, limit)
		if err != nil {
			return err
		}

		var id int64
		var orgID int64
		var uid, path string
		var createdBy int64
		var createdAt int64
		var lastSeenAt int64

		rawRows := make([]shortURLRow, 0, limit)
		for rows.Next() {
			err = rows.Scan(&id, &orgID, &uid, &path, &createdBy, &createdAt, &lastSeenAt)
			if err != nil {
				_ = rows.Close()
				return err
			}

			lastID = id
			rawRows = append(rawRows, shortURLRow{
				uid:        uid,
				path:       path,
				createdBy:  createdBy,
				createdAt:  createdAt,
				lastSeenAt: lastSeenAt,
			})
		}

		if err = rows.Err(); err != nil {
			_ = rows.Close()
			return err
		}

		_ = rows.Close()
		readDuration += time.Since(readStart)

		if len(rawRows) == 0 {
			break
		}

		convertStart := time.Now()
		chunk := make([]*resourcepb.BulkRequest, 0, len(rawRows))
		for _, row := range rawRows {
			shortURL := &shorturlv1beta1.ShortURL{
				TypeMeta: metav1.TypeMeta{
					APIVersion: shorturlv1beta1.GroupVersion.String(),
					Kind:       "ShortURL",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:              row.uid,
					Namespace:         opts.Namespace,
					CreationTimestamp: metav1.NewTime(time.Unix(row.createdAt, 0)),
				},
				Spec: shorturlv1beta1.ShortURLSpec{
					Path: row.path,
				},
				Status: shorturlv1beta1.ShortURLStatus{
					LastSeenAt: row.lastSeenAt,
				},
			}

			if row.createdBy > 0 {
				shortURL.SetCreatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(row.createdBy, 10)))
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
					Name:      row.uid,
				},
				Value:  body,
				Action: resourcepb.BulkRequest_ADDED,
			}
			chunk = append(chunk, req)
		}
		convertDuration += time.Since(convertStart)

		writeStart := time.Now()
		for _, req := range chunk {
			count++
			err = stream.Send(req)
			if err != nil {
				if errors.Is(err, io.EOF) {
					opts.Progress(count, fmt.Sprintf("stream EOF/cancelled. index=%d", count))
				}
				return err
			}
		}
		writeDuration += time.Since(writeStart)

		if int64(len(rawRows)) < limit {
			break
		}
	}

	opts.Progress(count, fmt.Sprintf("finished reading legacy short URLs from legacy short_url table in %s (%d)", readDuration, count))
	opts.Progress(count, fmt.Sprintf("finished converting legacy short URLs to unified storage format in %s (%d)", convertDuration, count))
	opts.Progress(count, fmt.Sprintf("finished writing short URLs to unified storage in %s (%d)", writeDuration, count))
	opts.Progress(-2, fmt.Sprintf("finished short URLs... (%d)", count))
	return nil
}

type shortURLRow struct {
	uid        string
	path       string
	createdBy  int64
	createdAt  int64
	lastSeenAt int64
}

func (m *shortURLMigrator) listShortURLs(ctx context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
	if m.listShortURLsFn != nil {
		return m.listShortURLsFn(ctx, orgID, lastID, limit)
	}
	return m.ListShortURLs(ctx, orgID, lastID, limit)
}

func (m *shortURLMigrator) ListShortURLs(ctx context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newShortURLQueryReq(helper, &ShortURLQuery{
		OrgID:  orgID,
		LastID: lastID,
		Limit:  limit,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryShortURLs, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryShortURLs.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}

type ShortURLQuery struct {
	OrgID  int64
	LastID int64
	Limit  int64
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
