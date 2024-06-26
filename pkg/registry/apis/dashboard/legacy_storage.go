package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/access"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.AppendingStore = (*dashboardStorage)(nil)
	_ resource.BlobStore      = (*dashboardStorage)(nil)
)

type dashboardStorage struct {
	resource       common.ResourceInfo
	access         access.DashboardAccess
	tableConverter rest.TableConvertor

	// Typically one... the server wrapper
	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

// func (s *dashboardStorage) Create(ctx context.Context,
// 	obj runtime.Object,
// 	createValidation rest.ValidateObjectFunc,
// 	options *metav1.CreateOptions,
// ) (runtime.Object, error) {
// 	info, err := request.NamespaceInfoFrom(ctx, true)
// 	if err != nil {
// 		return nil, err
// 	}

// 	p, ok := obj.(*v0alpha1.Dashboard)
// 	if !ok {
// 		return nil, fmt.Errorf("expected dashboard?")
// 	}

// 	// HACK to simplify unique name testing from kubectl
// 	t := p.Spec.GetNestedString("title")
// 	if strings.Contains(t, "${NOW}") {
// 		t = strings.ReplaceAll(t, "${NOW}", fmt.Sprintf("%d", time.Now().Unix()))
// 		p.Spec.Set("title", t)
// 	}

// 	dash, _, err := s.access.SaveDashboard(ctx, info.OrgID, p)
// 	return dash, err
// }

// func (s *dashboardStorage) Update(ctx context.Context,
// 	name string,
// 	objInfo rest.UpdatedObjectInfo,
// 	createValidation rest.ValidateObjectFunc,
// 	updateValidation rest.ValidateObjectUpdateFunc,
// 	forceAllowCreate bool,
// 	options *metav1.UpdateOptions,
// ) (runtime.Object, bool, error) {
// 	info, err := request.NamespaceInfoFrom(ctx, true)
// 	if err != nil {
// 		return nil, false, err
// 	}

// 	created := false
// 	old, err := s.Get(ctx, name, nil)
// 	if err != nil {
// 		return old, created, err
// 	}

// 	obj, err := objInfo.UpdatedObject(ctx, old)
// 	if err != nil {
// 		return old, created, err
// 	}
// 	p, ok := obj.(*v0alpha1.Dashboard)
// 	if !ok {
// 		return nil, created, fmt.Errorf("expected dashboard after update")
// 	}

// 	_, created, err = s.access.SaveDashboard(ctx, info.OrgID, p)
// 	if err == nil {
// 		r, err := s.Get(ctx, name, nil)
// 		return r, created, err
// 	}
// 	return nil, created, err
// }

// // GracefulDeleter
// func (s *dashboardStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
// 	info, err := request.NamespaceInfoFrom(ctx, true)
// 	if err != nil {
// 		return nil, false, err
// 	}

// 	return s.access.DeleteDashboard(ctx, info.OrgID, name)
// }

// func (s *dashboardStorage) ListXX(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
// 	orgId, err := request.OrgIDForList(ctx)
// 	if err != nil {
// 		return nil, err
// 	}

// 	// fmt.Printf("LIST: %s\n", options.Continue)

// 	// translate grafana.app/* label selectors into field requirements
// 	requirements, newSelector, err := entity.ReadLabelSelectors(options.LabelSelector)
// 	if err != nil {
// 		return nil, err
// 	}

// 	query := &access.DashboardQuery{
// 		OrgID:         orgId,
// 		Limit:         int(options.Limit),
// 		MaxBytes:      2 * 1024 * 1024, // 2MB,
// 		ContinueToken: options.Continue,
// 		Requirements:  requirements,
// 		Labels:        newSelector,
// 	}

// 	return s.access.GetDashboards(ctx, query)
// }

func (s *dashboardStorage) SupportsSignedURLs() bool {
	return false
}

func (s *dashboardStorage) PutBlob(context.Context, *resource.PutBlobRequest) (*resource.PutBlobResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (s *dashboardStorage) GetBlob(ctx context.Context, resource *resource.ResourceKey, info *utils.BlobInfo, mustProxy bool) (*resource.GetBlobResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func getDashbaord(event resource.WriteEvent) (*dashboard.Dashboard, error) {
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
		return fmt.Errorf("expecting dashboard group")
	}
	if key.Resource != gr.Resource {
		return fmt.Errorf("expecting dashboard resource")
	}
	if requireName && key.Name == "" {
		return fmt.Errorf("expecting dashboard name (uid)")
	}
	return nil
}

func (s *dashboardStorage) WriteEvent(ctx context.Context, event resource.WriteEvent) (rv int64, err error) {
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
			_, _, err = s.access.DeleteDashboard(ctx, info.OrgID, event.Key.Name)
			rv = event.EventID
		}
	// The difference depends on embedded internal ID
	case resource.WatchEvent_ADDED, resource.WatchEvent_MODIFIED:
		{
			dash, err := getDashbaord(event)
			if err != nil {
				return 0, err
			}

			after, _, err := s.access.SaveDashboard(ctx, info.OrgID, dash)
			if err != nil {
				return 0, err
			}
			if after != nil {
				meta, err := utils.MetaAccessor(after)
				if err != nil {
					return 0, err
				}
				rv, err = meta.GetResourceVersionInt64()
			}
		}
	default:
		return 0, fmt.Errorf("unsupported event type: %v", event.Type)
	}

	// Async notify all subscribers (not HA!!!)
	if s.subscribers != nil {
		go func() {
			write := &resource.WrittenEvent{
				WriteEvent: event,

				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: rv,
			}
			for _, sub := range s.subscribers {
				sub <- write
			}
		}()
	}
	return rv, err
}

// Read implements ResourceStoreServer.
func (s *dashboardStorage) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	info, err := request.ParseNamespace(req.Key.Namespace)
	if err == nil {
		err = isDashboardKey(req.Key, true)
	}
	if err != nil {
		return nil, err
	}
	if req.ResourceVersion > 0 {
		return nil, fmt.Errorf("reading from history not yet supported")
	}
	dash, err := s.access.GetDashboard(ctx, info.OrgID, req.Key.Name)
	if err != nil {
		return nil, err
	}
	meta, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, err
	}
	rv, err := meta.GetResourceVersionInt64()
	if err != nil {
		return nil, err
	}
	value, err := json.Marshal(dash)
	return &resource.ReadResponse{
		ResourceVersion: rv,
		Value:           value,
	}, err
}

// List implements AppendingStore.
func (s *dashboardStorage) List(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	opts := req.Options
	info, err := request.ParseNamespace(opts.Key.Namespace)
	if err == nil {
		err = isDashboardKey(opts.Key, false)
	}
	if err != nil {
		return nil, err
	}

	query := &access.DashboardQuery{
		OrgID:         info.OrgID,
		Limit:         int(req.Limit),
		MaxBytes:      2 * 1024 * 1024, // 2MB,
		ContinueToken: req.NextPageToken,
		// Requirements:  requirements,
		// Labels:        newSelector,
	}
	fmt.Printf("%+v\n", query)

	// return s.access.GetDashboards(ctx, query)

	return nil, fmt.Errorf("todo")
}

// Watch implements AppendingStore.
func (s *dashboardStorage) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	stream := make(chan *resource.WrittenEvent, 10)
	{
		s.mutex.Lock()
		defer s.mutex.Unlock()

		// Add the event stream
		s.subscribers = append(s.subscribers, stream)
	}

	// Wait for context done
	go func() {
		// Wait till the context is done
		<-ctx.Done()

		// Then remove the subscription
		s.mutex.Lock()
		defer s.mutex.Unlock()

		// Copy all streams without our listener
		subs := []chan *resource.WrittenEvent{}
		for _, sub := range s.subscribers {
			if sub != stream {
				subs = append(subs, sub)
			}
		}
		s.subscribers = subs
	}()
	return stream, nil
}
