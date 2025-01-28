package legacy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"google.golang.org/grpc/metadata"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type migrator = func(ctx context.Context, orgId int64, opts MigrateOptions, stream resource.ResourceStore_BatchProcessClient) error

func (a *dashboardSqlAccess) Migrate(ctx context.Context, opts MigrateOptions) (*resource.BatchResponse, error) {
	info, err := authlib.ParseNamespace(opts.Namespace)
	if err != nil {
		return nil, err
	}

	// Migrate everything
	if len(opts.Resources) == 1 && opts.Resources[0] == "*" {
		opts.SendHistory = true
		opts.Resources = []string{
			"folders",
			"dashboards",
			"panels",
		}
	}

	migrators := []migrator{}
	settings := resource.BatchSettings{
		RebuildCollection: true,
		SkipValidation:    true,
	}

	for _, res := range opts.Resources {
		switch res {
		case "folders":
			migrators = append(migrators, a.migrateFolders)
			settings.Collection = append(settings.Collection, &resource.ResourceKey{
				Namespace: opts.Namespace,
				Group:     folders.GROUP,
				Resource:  folders.RESOURCE,
			})

		case "panels":
			migrators = append(migrators, a.migratePanels)
			settings.Collection = append(settings.Collection, &resource.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.LIBRARY_PANEL_RESOURCE,
			})

		case "":
			fallthrough
		case "dashboards":
			migrators = append(migrators, a.migrateDashboards)
			settings.Collection = append(settings.Collection, &resource.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.DASHBOARD_RESOURCE,
			})
		default:
			return nil, fmt.Errorf("unsupported resource: %s", res)
		}
	}

	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	stream, err := opts.Store.BatchProcess(ctx)
	if err != nil {
		return nil, err
	}

	// Now run each migration
	for _, m := range migrators {
		err = m(ctx, info.OrgID, opts, stream)
		if err != nil {
			return nil, err
		}
	}

	return stream.CloseAndRecv()
}

func (a *dashboardSqlAccess) migrateDashboards(ctx context.Context, orgId int64, opts MigrateOptions, stream resource.ResourceStore_BatchProcessClient) error {
	query := &DashboardQuery{
		OrgID:      orgId,
		Limit:      100000000,
		GetHistory: opts.SendHistory, // include history
	}

	sql, err := a.sql(ctx)
	if err != nil {
		return err
	}

	opts.Progress(-1, "migrating dashboards...")
	rows, err := a.getRows(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return err
	}

	large := opts.LargeObjects

	// Now send each dashboard
	for i := 1; rows.Next(); i++ {
		dash := rows.row.Dash
		dash.APIVersion = fmt.Sprintf("%s/v0alpha1", dashboard.GROUP) // << eventually v0
		dash.SetNamespace(opts.Namespace)
		dash.SetResourceVersion("") // it will be filled in by the backend

		body, err := json.Marshal(dash)
		if err != nil {
			return err
		}

		req := &resource.BatchRequest{
			Key: &resource.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.DASHBOARD_RESOURCE,
				Name:      rows.Name(),
			},
			Value:  body,
			Folder: rows.row.FolderUID,
			Action: resource.BatchRequest_ADDED,
		}
		if dash.Generation > 1 {
			req.Action = resource.BatchRequest_MODIFIED
		} else if dash.Generation < 0 {
			req.Action = resource.BatchRequest_DELETED
		}

		// With large object support
		if large != nil && len(body) > large.Threshold() {
			obj, err := utils.MetaAccessor(dash)
			if err != nil {
				return err
			}

			opts.Progress(i, fmt.Sprintf("[v:%d] %s Large object (%d)", dash.Generation, dash.Name, len(body)))
			err = large.Deconstruct(ctx, req.Key, opts.Store, obj, req.Value)
			if err != nil {
				return err
			}

			// The smaller version (most of spec removed)
			req.Value, err = json.Marshal(dash)
			if err != nil {
				return err
			}
		}

		opts.Progress(i, fmt.Sprintf("[v:%d] %s (size:%d / %d|%d)", dash.Generation, dash.Name, len(req.Value), i, rows.count))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				opts.Progress(i, fmt.Sprintf("stream EOF/cancelled. index=%d", i))
				err = nil
			}
			return err
		}
	}

	return nil
}

func (a *dashboardSqlAccess) migrateFolders(ctx context.Context, orgId int64, opts MigrateOptions, stream resource.ResourceStore_BatchProcessClient) error {
	query := &DashboardQuery{
		OrgID:      orgId,
		Limit:      100000000,
		GetFolders: true,
	}

	sql, err := a.sql(ctx)
	if err != nil {
		return err
	}

	opts.Progress(-1, "migrating folders...")
	rows, err := a.getRows(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return err
	}

	// Now send each dashboard
	for i := 1; rows.Next(); i++ {
		dash := rows.row.Dash
		dash.APIVersion = "folder.grafana.app/v0alpha1"
		dash.Kind = "Folder"
		dash.SetNamespace(opts.Namespace)
		dash.SetResourceVersion("") // it will be filled in by the backend

		spec := map[string]any{
			"title": dash.Spec.Object["title"],
		}
		description := dash.Spec.Object["description"]
		if description != nil {
			spec["description"] = description
		}
		dash.Spec.Object = spec

		body, err := json.Marshal(dash)
		if err != nil {
			return err
		}

		req := &resource.BatchRequest{
			Key: &resource.ResourceKey{
				Namespace: opts.Namespace,
				Group:     "folder.grafana.app",
				Resource:  "folders",
				Name:      rows.Name(),
			},
			Value:  body,
			Folder: rows.row.FolderUID,
			Action: resource.BatchRequest_ADDED,
		}
		if dash.Generation > 1 {
			req.Action = resource.BatchRequest_MODIFIED
		} else if dash.Generation < 0 {
			req.Action = resource.BatchRequest_DELETED
		}

		opts.Progress(i, fmt.Sprintf("[v:%d] %s (%d)", dash.Generation, dash.Name, len(req.Value)))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}

	return nil
}

func (a *dashboardSqlAccess) migratePanels(ctx context.Context, orgId int64, opts MigrateOptions, stream resource.ResourceStore_BatchProcessClient) error {
	opts.Progress(-1, "migrating library panels...")
	panels, err := a.GetLibraryPanels(ctx, LibraryPanelQuery{
		OrgID: orgId,
		Limit: 1000000,
	})
	if err != nil {
		return err
	}
	for i, panel := range panels.Items {
		meta, err := utils.MetaAccessor(&panel)
		if err != nil {
			return err
		}
		body, err := json.Marshal(panel)
		if err != nil {
			return err
		}

		req := &resource.BatchRequest{
			Key: &resource.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboard.GROUP,
				Resource:  dashboard.LIBRARY_PANEL_RESOURCE,
				Name:      panel.Name,
			},
			Value:  body,
			Folder: meta.GetFolder(),
			Action: resource.BatchRequest_ADDED,
		}
		if panel.Generation > 1 {
			req.Action = resource.BatchRequest_MODIFIED
		}

		opts.Progress(i, fmt.Sprintf("[v:%d] %s (%d)", i, meta.GetName(), len(req.Value)))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}
	return nil
}
