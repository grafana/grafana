package rulesync

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// fakeConfigClient is an in-memory resource.ClientGenerator + resource.Client
// that serves rules Config objects for the syncer's API-path tests. Mirrors
// the external Alertmanager sync's own fakeConfigClient. Only the read/write
// paths the worker exercises (Get, Create, Update) are meaningful; the rest
// are inert stubs. Status writes (Update) merge into the seeded object so the
// spec survives across ticks.
type fakeConfigClient struct {
	mu       sync.Mutex
	nsMapper request.NamespaceMapper
	objects  map[string]*alertingrulesv0alpha1.Config // namespace -> object
	getErr   map[string]error                         // namespace -> error returned by Get
	getCalls map[string]int                           // namespace -> Get call count
}

func newFakeConfigClient() *fakeConfigClient {
	return &fakeConfigClient{
		nsMapper: func(orgID int64) string { return fmt.Sprintf("org-%d", orgID) },
		objects:  map[string]*alertingrulesv0alpha1.Config{},
		getErr:   map[string]error{},
		getCalls: map[string]int{},
	}
}

// setSpec seeds a Config for orgID carrying the given externalRulerSync spec
// fields. An empty datasourceUID seeds a config with no externalRulerSync set.
func (f *fakeConfigClient) setSpec(orgID int64, datasourceUID, targetDatasourceUID string) {
	f.setSpecWithPromote(orgID, datasourceUID, targetDatasourceUID, false)
}

// setSpecWithPromote is setSpec plus the promote flag.
func (f *fakeConfigClient) setSpecWithPromote(orgID int64, datasourceUID, targetDatasourceUID string, promote bool) {
	obj := &alertingrulesv0alpha1.Config{}
	obj.SetNamespace(f.nsMapper(orgID))
	obj.SetName(alertingrulesv0alpha1.ConfigSingletonName)
	obj.SetResourceVersion("1")
	if datasourceUID != "" {
		spec := &alertingrulesv0alpha1.ConfigV0alpha1SpecExternalRulerSync{DatasourceUid: &datasourceUID}
		if targetDatasourceUID != "" {
			spec.TargetDatasourceUid = &targetDatasourceUID
		}
		spec.Promote = &promote
		obj.Spec.ExternalRulerSync = spec
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.objects[obj.GetNamespace()] = obj
}

// setErr makes Get for orgID return err (simulating a storage failure).
func (f *fakeConfigClient) setErr(orgID int64, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getErr[f.nsMapper(orgID)] = err
}

// getCallCount reports how many Get calls the worker made for orgID.
func (f *fakeConfigClient) getCallCount(orgID int64) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.getCalls[f.nsMapper(orgID)]
}

// statusFor returns the last-written status for orgID, or nil if none exists.
func (f *fakeConfigClient) statusFor(orgID int64) *alertingrulesv0alpha1.ConfigStatus {
	f.mu.Lock()
	defer f.mu.Unlock()
	obj, ok := f.objects[f.nsMapper(orgID)]
	if !ok {
		return nil
	}
	st := obj.Status
	return &st
}

// resource.ClientGenerator

func (f *fakeConfigClient) ClientFor(resource.Kind) (resource.Client, error) { return f, nil }

func (f *fakeConfigClient) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}
func (f *fakeConfigClient) DiscoveryClient() (resource.DiscoveryClient, error) { return nil, nil }

// resource.Client — only Get/Create/Update (and their *Into variants) are meaningful.

func (f *fakeConfigClient) lookup(ns string) (*alertingrulesv0alpha1.Config, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getCalls[ns]++
	if err := f.getErr[ns]; err != nil {
		return nil, err
	}
	obj, ok := f.objects[ns]
	if !ok {
		return nil, k8serrors.NewNotFound(alertingrulesv0alpha1.ConfigKind().GroupVersionResource().GroupResource(), alertingrulesv0alpha1.ConfigSingletonName)
	}
	return obj, nil
}

// apply stores obj, merging an incoming status onto any existing object so a
// status write doesn't clobber the seeded spec.
func (f *fakeConfigClient) apply(obj resource.Object) resource.Object {
	rc, ok := obj.(*alertingrulesv0alpha1.Config)
	if !ok {
		return obj
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if existing, ok := f.objects[rc.GetNamespace()]; ok {
		merged := *existing
		merged.Status = rc.Status
		f.objects[rc.GetNamespace()] = &merged
		return &merged
	}
	cp := *rc
	f.objects[rc.GetNamespace()] = &cp
	return &cp
}

func (f *fakeConfigClient) Get(_ context.Context, id resource.Identifier) (resource.Object, error) {
	return f.lookup(id.Namespace)
}

func (f *fakeConfigClient) GetInto(_ context.Context, id resource.Identifier, into resource.Object) error {
	obj, err := f.lookup(id.Namespace)
	if err != nil {
		return err
	}
	if t, ok := into.(*alertingrulesv0alpha1.Config); ok {
		*t = *obj
	}
	return nil
}

func (f *fakeConfigClient) Create(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	return f.apply(obj), nil
}

func (f *fakeConfigClient) CreateInto(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions, _ resource.Object) error {
	_, err := f.Create(ctx, id, obj, opts)
	return err
}

func (f *fakeConfigClient) Update(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	return f.apply(obj), nil
}

func (f *fakeConfigClient) UpdateInto(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions, _ resource.Object) error {
	_, err := f.Update(ctx, id, obj, opts)
	return err
}

func (f *fakeConfigClient) Patch(_ context.Context, _ resource.Identifier, _ resource.PatchRequest, _ resource.PatchOptions) (resource.Object, error) {
	return nil, nil
}

func (f *fakeConfigClient) PatchInto(_ context.Context, _ resource.Identifier, _ resource.PatchRequest, _ resource.PatchOptions, _ resource.Object) error {
	return nil
}

func (f *fakeConfigClient) Delete(_ context.Context, _ resource.Identifier, _ resource.DeleteOptions) error {
	return nil
}

func (f *fakeConfigClient) List(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
	return nil, nil
}

func (f *fakeConfigClient) ListInto(_ context.Context, _ string, _ resource.ListOptions, _ resource.ListObject) error {
	return nil
}

func (f *fakeConfigClient) Watch(_ context.Context, _ string, _ resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, nil
}

func (f *fakeConfigClient) SubresourceRequest(_ context.Context, _ resource.Identifier, _ resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
}
