package legacy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func getDashboardFromEvent(event resource.WriteEvent) (*dashboard.Dashboard, error) {
	obj, ok := event.Object.GetRuntimeObject()
	if ok && obj != nil {
		dash, ok := obj.(*dashboard.Dashboard)
		if ok {
			return dash, nil
		}
	}
	dash := &dashboard.Dashboard{}
	err := json.Unmarshal(event.Value, dash)
	return dash, err
}

func isDashboardKey(key *resource.ResourceKey, requireName bool) error {
	gr := dashboard.DashboardResourceInfo.GroupResource()
	if key.Group != gr.Group {
		return fmt.Errorf("expecting dashboard group (%s != %s)", key.Group, gr.Group)
	}
	if key.Resource != gr.Resource {
		return fmt.Errorf("expecting dashboard resource (%s != %s)", key.Resource, gr.Resource)
	}
	if requireName && key.Name == "" {
		return fmt.Errorf("expecting dashboard name (uid)")
	}
	return nil
}

func (a *dashboardSqlAccess) WriteEvent(ctx context.Context, event resource.WriteEvent) (rv int64, err error) {
	info, err := claims.ParseNamespace(event.Key.Namespace)
	if err == nil {
		err = isDashboardKey(event.Key, true)
	}
	if err != nil {
		return 0, err
	}

	switch event.Type {
	case resource.WatchEvent_DELETED:
		{
			_, _, err = a.DeleteDashboard(ctx, info.OrgID, event.Key.Name)
			//rv = ???
		}
	// The difference depends on embedded internal ID
	case resource.WatchEvent_ADDED, resource.WatchEvent_MODIFIED:
		{
			dash, err := getDashboardFromEvent(event)
			if err != nil {
				return 0, err
			}

			after, _, err := a.SaveDashboard(ctx, info.OrgID, dash)
			if err != nil {
				return 0, err
			}
			if after != nil {
				meta, err := utils.MetaAccessor(after)
				if err != nil {
					return 0, err
				}
				rv, err = meta.GetResourceVersionInt64()
				if err != nil {
					return 0, err
				}
			}
		}
	default:
		return 0, fmt.Errorf("unsupported event type: %v", event.Type)
	}

	// Async notify all subscribers (not HA!!!)
	if a.subscribers != nil {
		go func() {
			write := &resource.WrittenEvent{
				WriteEvent: event,

				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: rv,
			}
			for _, sub := range a.subscribers {
				sub <- write
			}
		}()
	}
	return rv, err
}

func (a *dashboardSqlAccess) GetDashboard(ctx context.Context, orgId int64, uid string, v int64) (*dashboard.Dashboard, int64, error) {
	sql, err := a.sql(ctx)
	if err != nil {
		return nil, 0, err
	}

	rows, err := a.getRows(ctx, sql, &DashboardQuery{
		OrgID:   orgId,
		UID:     uid,
		Limit:   2, // will only be one!
		Version: v,
	})
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	if rows.Next() {
		row := rows.row
		if row != nil {
			return row.Dash, row.RV, rows.err
		}
	}
	return nil, 0, rows.err
}

// Read implements ResourceStoreServer.
func (a *dashboardSqlAccess) ReadResource(ctx context.Context, req *resource.ReadRequest) *resource.BackendReadResponse {
	rsp := &resource.BackendReadResponse{}
	info, err := claims.ParseNamespace(req.Key.Namespace)
	if err == nil {
		err = isDashboardKey(req.Key, true)
	}
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}
	version := int64(0)
	if req.ResourceVersion > 0 {
		version = getVersionFromRV(req.ResourceVersion)
	}

	dash, rv, err := a.GetDashboard(ctx, info.OrgID, req.Key.Name, version)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}
	if dash == nil {
		rsp.Error = &resource.ErrorResult{
			Code: http.StatusNotFound,
		}
	} else {
		rsp.Value, err = json.Marshal(dash)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
		}
	}
	rsp.ResourceVersion = rv
	return rsp
}

// List implements AppendingStore.
func (a *dashboardSqlAccess) ListIterator(ctx context.Context, req *resource.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	opts := req.Options
	info, err := claims.ParseNamespace(opts.Key.Namespace)
	if err == nil {
		err = isDashboardKey(opts.Key, false)
	}
	if err != nil {
		return 0, err
	}

	token, err := readContinueToken(req.NextPageToken)
	if err != nil {
		return 0, err
	}
	if token.orgId > 0 && token.orgId != info.OrgID {
		return 0, fmt.Errorf("token and orgID mismatch")
	}

	query := &DashboardQuery{
		OrgID:  info.OrgID,
		Limit:  int(req.Limit),
		LastID: token.id,
		Labels: req.Options.Labels,
	}

	sql, err := a.sql(ctx)
	if err != nil {
		return 0, err
	}

	switch req.Source {
	case resource.ListRequest_HISTORY:
		query.GetHistory = true
		query.UID = req.Options.Key.Name
	case resource.ListRequest_TRASH:
		query.GetTrash = true
	case resource.ListRequest_STORE:
		// normal
	}

	listRV, err := sql.GetResourceVersion(ctx, "dashboard", "updated")
	if err != nil {
		return 0, err
	}
	rows, err := a.getRows(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err == nil {
		err = cb(rows)
	}
	return listRV, err
}

// Watch implements AppendingStore.
func (a *dashboardSqlAccess) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	stream := make(chan *resource.WrittenEvent, 10)
	{
		a.mutex.Lock()
		defer a.mutex.Unlock()

		// Add the event stream
		a.subscribers = append(a.subscribers, stream)
	}

	// Wait for context done
	go func() {
		// Wait till the context is done
		<-ctx.Done()

		// Then remove the subscription
		a.mutex.Lock()
		defer a.mutex.Unlock()

		// Copy all streams without our listener
		subs := []chan *resource.WrittenEvent{}
		for _, sub := range a.subscribers {
			if sub != stream {
				subs = append(subs, sub)
			}
		}
		a.subscribers = subs
	}()
	return stream, nil
}

// Simple wrapper for index implementation
func (a *dashboardSqlAccess) Read(ctx context.Context, req *resource.ReadRequest) (*resource.BackendReadResponse, error) {
	return a.ReadResource(ctx, req), nil
}

// TODO: this needs to be implemented
func (a *dashboardSqlAccess) Search(ctx context.Context, req *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	return nil, fmt.Errorf("not yet (filter)")
}

func (a *dashboardSqlAccess) ListRepositoryObjects(ctx context.Context, req *resource.ListRepositoryObjectsRequest) (*resource.ListRepositoryObjectsResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (a *dashboardSqlAccess) CountRepositoryObjects(context.Context, *resource.CountRepositoryObjectsRequest) (*resource.CountRepositoryObjectsResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// GetStats implements ResourceServer.
func (a *dashboardSqlAccess) GetStats(ctx context.Context, req *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	info, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return nil, fmt.Errorf("unable to read namespace")
	}
	if info.OrgID == 0 {
		return nil, fmt.Errorf("invalid OrgID found in namespace")
	}

	if len(req.Kinds) != 1 {
		return nil, fmt.Errorf("only can query for dashboard kind in legacy fallback")
	}

	parts := strings.SplitN(req.Kinds[0], "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid kind")
	}

	count, err := a.dashStore.CountInOrg(ctx, info.OrgID)
	if err != nil {
		return nil, err
	}

	return &resource.ResourceStatsResponse{
		Stats: []*resource.ResourceStatsResponse_Stats{
			{
				Group:    parts[0],
				Resource: parts[1],
				Count:    count,
			},
		},
	}, nil
}

func (a *dashboardSqlAccess) Migrate(ctx context.Context, opts MigrateOptions) (*resource.BatchResponse, error) {
	info, err := claims.ParseNamespace(opts.Namespace)
	if err != nil {
		return nil, err
	}

	query := &DashboardQuery{
		OrgID:      info.OrgID,
		Limit:      10000000,
		GetHistory: opts.SendHistory, // include history
	}

	sql, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := a.getRows(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return nil, err
	}

	settings := resource.BatchSettings{
		RebuildCollection: true,
		SkipValidation:    true,
		Collection: []*resource.ResourceKey{{
			Namespace: opts.Namespace,
			Group:     dashboard.GROUP,
			Resource:  dashboard.DASHBOARD_RESOURCE,
		}},
	}
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	stream, err := opts.Store.BatchProcess(ctx)
	if err != nil {
		return nil, err
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
			return nil, err
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
				return nil, err
			}

			opts.Progress(i, fmt.Sprintf("[v:%d] %s Large object (%d)", dash.Generation, dash.Name, len(body)))
			err = large.Deconstruct(ctx, req.Key, opts.Store, obj, req.Value)
			if err != nil {
				return nil, err
			}

			// The smaller version (most of spec removed)
			req.Value, err = json.Marshal(dash)
			if err != nil {
				return nil, err
			}
		}

		opts.Progress(i, fmt.Sprintf("[v:%d] %s (%d)", dash.Generation, dash.Name, len(req.Value)))

		err = stream.Send(req)
		if err != nil {
			return nil, err
		}
	}
	return stream.CloseAndRecv()
}
