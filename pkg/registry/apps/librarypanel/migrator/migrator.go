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

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"
	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed query_librarypanels.sql
var libraryPanelSQLTemplatesFS embed.FS

var sqlQueryLibraryPanels = template.Must(
	template.New("sql").ParseFS(libraryPanelSQLTemplatesFS, "query_librarypanels.sql"),
).Lookup("query_librarypanels.sql")

type LibraryPanelMigrator interface {
	MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// libraryPanelMigrator handles migrating library panels from legacy SQL storage.
type libraryPanelMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideLibraryPanelMigrator creates a libraryPanelMigrator for use in wire DI.
func ProvideLibraryPanelMigrator(sql legacysql.LegacyDatabaseProvider) LibraryPanelMigrator {
	return &libraryPanelMigrator{sql: sql}
}

// libraryPanelRow holds the columns scanned from library_element. Buffered in
// memory before streaming so the DB cursor closes before the gRPC send loop.
type libraryPanelRow struct {
	id          int64
	uid         string
	name        string
	panelType   string
	description string
	model       []byte
	version     int64
	folderUID   sql.NullString
	created     time.Time
	updated     time.Time
	createdBy   sql.NullString
	updatedBy   sql.NullString
}

// MigrateLibraryPanels reads library panels from legacy SQL storage and streams
// them as Kubernetes resources to the unified storage bulk process API.
func (m *libraryPanelMigrator) MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating library panels...")

	panels, err := m.listLibraryPanels(ctx, orgId)
	if err != nil {
		return err
	}

	for i, p := range panels {
		panel, err := buildLibraryPanel(p, opts.Namespace)
		if err != nil {
			return fmt.Errorf("error building library panel %q: %w", p.uid, err)
		}

		body, err := json.Marshal(panel)
		if err != nil {
			return err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboardV0.GROUP,
				Resource:  dashboardV0.LIBRARY_PANEL_RESOURCE,
				Name:      p.uid,
			},
			Value:  body,
			Folder: p.folderUID.String,
			Action: resourcepb.BulkRequest_ADDED,
		}
		if p.version > 1 {
			req.Action = resourcepb.BulkRequest_MODIFIED
		}

		opts.Progress(i, fmt.Sprintf("%s (%d)", p.name, len(req.Value)))

		if err := stream.Send(req); err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}

	opts.Progress(-2, fmt.Sprintf("finished library panels... (%d)", len(panels)))
	return nil
}

// buildLibraryPanel constructs a LibraryPanel resource from a SQL row. The
// column values for name/description/type override what is in the model blob,
// matching the runtime LibraryPanelStore semantics.
func buildLibraryPanel(p libraryPanelRow, namespace string) (*dashboardV0.LibraryPanel, error) {
	panel := &dashboardV0.LibraryPanel{
		TypeMeta: metav1.TypeMeta{
			APIVersion: dashboardV0.APIVERSION,
			Kind:       "LibraryPanel",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              p.uid,
			Namespace:         namespace,
			CreationTimestamp: metav1.NewTime(p.created),
			ResourceVersion:   strconv.FormatInt(p.updated.UnixMicro(), 10),
		},
	}

	if len(p.model) > 0 {
		if err := json.Unmarshal(p.model, &panel.Spec); err != nil {
			return nil, fmt.Errorf("unmarshal model: %w", err)
		}
	}

	// The panel title used in dashboards and the title of the library panel can
	// differ. In the legacy model blob, the panel title is "title"; the library
	// panel title comes from the "name" column.
	panel.Spec.PanelTitle = panel.Spec.Title
	panel.Spec.Title = p.name
	panel.Spec.Description = p.description
	panel.Spec.Type = p.panelType

	meta, err := utils.MetaAccessor(panel)
	if err != nil {
		return nil, err
	}
	if p.folderUID.Valid {
		meta.SetFolder(p.folderUID.String)
	}
	meta.SetCreatedBy(formatUserID(p.createdBy))
	meta.SetGeneration(p.version)
	meta.SetDeprecatedInternalID(p.id) //nolint:staticcheck

	// Only record updated metadata when it diverges meaningfully from created.
	if p.updatedBy.Valid && p.updated.Sub(p.created) > time.Second {
		meta.SetUpdatedBy(formatUserID(p.updatedBy))
		updated := p.updated
		meta.SetUpdatedTimestamp(&updated)
	}

	return panel, nil
}

func formatUserID(uid sql.NullString) string {
	if uid.Valid && uid.String != "" {
		return claims.NewTypeID(claims.TypeUser, uid.String)
	}
	return ""
}

type libraryPanelQuery struct {
	OrgID int64
}

type sqlLibraryPanelQuery struct {
	sqltemplate.SQLTemplate
	Query *libraryPanelQuery

	LibraryElementTable string
	UserTable           string
}

func (r sqlLibraryPanelQuery) Validate() error {
	return nil
}

func newLibraryPanelQueryReq(helper *legacysql.LegacyDatabaseHelper, query *libraryPanelQuery) sqlLibraryPanelQuery {
	return sqlLibraryPanelQuery{
		SQLTemplate:         sqltemplate.New(helper.DialectForDriver()),
		Query:               query,
		LibraryElementTable: helper.Table("library_element"),
		UserTable:           helper.Table("user"),
	}
}

func (m *libraryPanelMigrator) listLibraryPanels(ctx context.Context, orgID int64) ([]libraryPanelRow, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newLibraryPanelQueryReq(helper, &libraryPanelQuery{OrgID: orgID})
	rawQuery, err := sqltemplate.Execute(sqlQueryLibraryPanels, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryLibraryPanels.Name(), err)
	}

	rows, err := helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var out []libraryPanelRow
	for rows.Next() {
		var (
			r       libraryPanelRow
			orgScan int64
		)
		if err := rows.Scan(
			&r.id,
			&orgScan,
			&r.uid,
			&r.name,
			&r.panelType,
			&r.description,
			&r.model,
			&r.version,
			&r.folderUID,
			&r.created,
			&r.updated,
			&r.createdBy,
			&r.updatedBy,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
