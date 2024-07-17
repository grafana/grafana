package legacy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
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
	info, err := request.ParseNamespace(event.Key.Namespace)
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

// Read implements ResourceStoreServer.
func (a *dashboardSqlAccess) GetDashboard(ctx context.Context, orgId int64, uid string, v int64) (*dashboard.Dashboard, int64, error) {
	rows, _, err := a.getRows(ctx, &DashboardQuery{
		OrgID:   orgId,
		UID:     uid,
		Limit:   2, // will only be one!
		Version: v,
	})
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	row, err := rows.Next()
	if err != nil || row == nil {
		return nil, 0, err
	}
	return row.Dash, row.RV, nil
}

// Read implements ResourceStoreServer.
func (a *dashboardSqlAccess) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	info, err := request.ParseNamespace(req.Key.Namespace)
	if err == nil {
		err = isDashboardKey(req.Key, true)
	}
	if err != nil {
		return nil, err
	}
	version := int64(0)
	if req.ResourceVersion > 0 {
		version = getVersionFromRV(req.ResourceVersion)
	}

	dash, rv, err := a.GetDashboard(ctx, info.OrgID, req.Key.Name, version)
	if err != nil {
		return nil, err
	}
	if dash == nil {
		return &resource.ReadResponse{
			Error: &resource.ErrorResult{
				Code: http.StatusNotFound,
			},
		}, err
	}

	value, err := json.Marshal(dash)
	return &resource.ReadResponse{
		ResourceVersion: rv,
		Value:           value,
	}, err
}

// List implements AppendingStore.
func (a *dashboardSqlAccess) PrepareList(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	opts := req.Options
	info, err := request.ParseNamespace(opts.Key.Namespace)
	if err == nil {
		err = isDashboardKey(opts.Key, false)
	}
	if err != nil {
		return nil, err
	}

	token, err := readContinueToken(req.NextPageToken)
	if err != nil {
		return nil, err
	}
	if token.orgId > 0 && token.orgId != info.OrgID {
		return nil, fmt.Errorf("token and orgID mismatch")
	}

	query := &DashboardQuery{
		OrgID:    info.OrgID,
		Limit:    int(req.Limit),
		MaxBytes: 2 * 1024 * 1024, // 2MB,
		LastID:   token.id,
		Labels:   req.Options.Labels,
	}

	rows, limit, err := a.getRows(ctx, query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	totalSize := 0
	list := &resource.ListResponse{}
	for {
		row, err := rows.Next()
		if err != nil || row == nil {
			return list, err
		}

		totalSize += row.Bytes
		if len(list.Items) > 0 && (totalSize > query.MaxBytes || len(list.Items) >= limit) {
			// if query.Requirements.Folder != nil {
			// 	row.token.folder = *query.Requirements.Folder
			// }
			list.NextPageToken = row.token.String() // will skip this one but start here next time
			return list, err
		}
		// TODO -- make it smaller and stick the body as an annotation...
		val, err := json.Marshal(row.Dash)
		if err != nil {
			return list, err
		}
		list.Items = append(list.Items, &resource.ResourceWrapper{
			ResourceVersion: row.RV,
			Value:           val,
		})
	}
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

func (a *dashboardSqlAccess) History(ctx context.Context, req *resource.HistoryRequest) (*resource.HistoryResponse, error) {
	info, err := request.ParseNamespace(req.Key.Namespace)
	if err == nil {
		err = isDashboardKey(req.Key, false)
	}
	if err != nil {
		return nil, err
	}

	token, err := readContinueToken(req.NextPageToken)
	if err != nil {
		return nil, err
	}
	if token.orgId > 0 && token.orgId != info.OrgID {
		return nil, fmt.Errorf("token and orgID mismatch")
	}

	query := &DashboardQuery{
		OrgID:    info.OrgID,
		Limit:    int(req.Limit),
		MaxBytes: 2 * 1024 * 1024, // 2MB,
		LastID:   token.id,
		UID:      req.Key.Name,
	}
	if req.ShowDeleted {
		query.GetTrash = true
	} else {
		query.GetHistory = true
	}

	rows, limit, err := a.getRows(ctx, query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	totalSize := 0
	list := &resource.HistoryResponse{}
	for {
		row, err := rows.Next()
		if err != nil || row == nil {
			return list, err
		}

		totalSize += row.Bytes
		if len(list.Items) > 0 && (totalSize > query.MaxBytes || len(list.Items) >= limit) {
			// if query.Requirements.Folder != nil {
			// 	row.token.folder = *query.Requirements.Folder
			// }
			row.token.id = getVersionFromRV(row.RV) // Use the version as the increment
			list.NextPageToken = row.token.String() // will skip this one but start here next time
			return list, err
		}

		partial := &metav1.PartialObjectMetadata{
			ObjectMeta: row.Dash.ObjectMeta,
		}
		partial.UID = "" // it is not useful/helpful/accurate and just confusing now

		val, err := json.Marshal(partial)
		if err != nil {
			return list, err
		}
		full, err := json.Marshal(row.Dash.Spec)
		if err != nil {
			return list, err
		}
		list.Items = append(list.Items, &resource.ResourceMeta{
			ResourceVersion:   row.RV,
			PartialObjectMeta: val,
			Size:              int32(len(full)),
			Hash:              "??", // hash the full?
		})
	}
}

// Used for efficient provisioning
func (a *dashboardSqlAccess) Origin(context.Context, *resource.OriginRequest) (*resource.OriginResponse, error) {
	return nil, fmt.Errorf("not yet (origin)")
}
