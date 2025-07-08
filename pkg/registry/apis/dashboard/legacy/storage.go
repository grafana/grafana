package legacy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	claims "github.com/grafana/authlib/types"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

func getProvisioningDataFromEvent(event resource.WriteEvent) (*dashboards.DashboardProvisioning, error) {
	obj, ok := event.Object.GetRuntimeObject()
	if !ok {
		return nil, fmt.Errorf("object is not a runtime object")
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	provisioningData, ok := meta.GetManagerProperties()
	if !ok || (provisioningData.Kind != utils.ManagerKindClassicFP) { //nolint:staticcheck
		return nil, nil
	}
	source, ok := meta.GetSourceProperties()
	if !ok {
		return nil, nil
	}
	provisioning := &dashboards.DashboardProvisioning{
		Name:       provisioningData.Identity,
		ExternalID: source.Path,
		CheckSum:   source.Checksum,
	}
	if source.TimestampMillis > 0 {
		provisioning.Updated = time.UnixMilli(source.TimestampMillis).Unix()
	}

	return provisioning, nil
}

func isDashboardKey(key *resourcepb.ResourceKey, requireName bool) error {
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
	case resourcepb.WatchEvent_DELETED:
		{
			_, _, err = a.DeleteDashboard(ctx, info.OrgID, event.Key.Name)
			//rv = ???
		}
	// The difference depends on embedded internal ID
	case resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED:
		{
			dash, err := getDashboardFromEvent(event)
			if err != nil {
				return 0, err
			}
			// In unistore, provisioning data is stored as annotations on the dashboard object. In legacy, it is stored in a separate
			// database table. For the legacy fallback, we need to save the provisioning data in the same transaction - so we need to handle these separately.
			// Without this, we can end up having dashboards created in legacy, unistore timing out, and then never saving the provisioning data, which
			// results in duplicated dashboards on next startup.
			provisioning, err := getProvisioningDataFromEvent(event)
			if err != nil {
				return 0, err
			}
			if provisioning != nil {
				cmd, _, err := a.buildSaveDashboardCommand(ctx, info.OrgID, dash)
				if err != nil {
					return 0, err
				}

				after, err := a.dashStore.SaveProvisionedDashboard(ctx, *cmd, provisioning)
				if err != nil {
					return 0, err
				}

				// dashboard version is the RV in legacy storage
				if after != nil {
					rv = int64(after.Version)
				}
			} else {
				failOnExisting := event.Type == resourcepb.WatchEvent_ADDED
				after, _, err := a.SaveDashboard(ctx, info.OrgID, dash, failOnExisting)
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
		}
	default:
		return 0, fmt.Errorf("unsupported event type: %v", event.Type)
	}

	// Async notify all subscribers (not HA!!!)
	if a.subscribers != nil {
		go func() {
			write := &resource.WrittenEvent{
				Type:       event.Type,
				Key:        event.Key,
				PreviousRV: event.PreviousRV,
				Value:      event.Value,

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
func (a *dashboardSqlAccess) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
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
		version = req.ResourceVersion
	}

	dash, rv, err := a.GetDashboard(ctx, info.OrgID, req.Key.Name, version)
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
		return rsp
	}
	if dash == nil {
		rsp.Error = &resourcepb.ErrorResult{
			Code: http.StatusNotFound,
		}
	} else {
		meta, err := utils.MetaAccessor(dash)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
		}
		rsp.Folder = meta.GetFolder()

		rsp.Value, err = json.Marshal(dash)
		if err != nil {
			rsp.Error = resource.AsErrorResult(err)
		}
	}
	rsp.ResourceVersion = rv
	return rsp
}

// ListHistory implements StorageBackend.
func (a *dashboardSqlAccess) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	return a.ListIterator(ctx, req, cb)
}

// List implements StorageBackend.
func (a *dashboardSqlAccess) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(resource.ListIterator) error) (int64, error) {
	if req.ResourceVersion != 0 {
		return 0, apierrors.NewBadRequest("List with explicit resourceVersion is not supported with this storage backend")
	}
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
	case resourcepb.ListRequest_HISTORY:
		query.GetHistory = true
		query.UID = req.Options.Key.Name
	case resourcepb.ListRequest_TRASH:
		query.GetTrash = true
	case resourcepb.ListRequest_STORE:
		// normal
	}

	listRV, err := sql.GetResourceVersion(ctx, "dashboard", "updated")
	if err != nil {
		return 0, err
	}
	listRV *= 1000 // Convert to microseconds
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
func (a *dashboardSqlAccess) Read(ctx context.Context, req *resourcepb.ReadRequest) (*resource.BackendReadResponse, error) {
	return a.ReadResource(ctx, req), nil
}

func (a *dashboardSqlAccess) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return a.dashboardSearchClient.Search(ctx, req)
}

func (a *dashboardSqlAccess) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (a *dashboardSqlAccess) CountManagedObjects(context.Context, *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// GetStats implements ResourceServer.
func (a *dashboardSqlAccess) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	return a.dashboardSearchClient.GetStats(ctx, req)
}
