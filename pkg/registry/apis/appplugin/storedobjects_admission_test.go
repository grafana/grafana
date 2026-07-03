package appplugin

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/grafana/pkg/plugins"
)

// fakePluginClient records admission calls and returns canned responses. The
// health and resource handlers exist only to satisfy the PluginClient
// interface.
type fakePluginClient struct {
	validateCalls []*backend.AdmissionRequest
	mutateCalls   []*backend.AdmissionRequest

	validateResp *backend.ValidationResponse
	validateErr  error
	mutateResp   *backend.MutationResponse
	mutateErr    error
}

func (f *fakePluginClient) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, errors.New("not implemented")
}

func (f *fakePluginClient) CallResource(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
	return errors.New("not implemented")
}

func (f *fakePluginClient) ValidateAdmission(_ context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	f.validateCalls = append(f.validateCalls, req)
	return f.validateResp, f.validateErr
}

func (f *fakePluginClient) MutateAdmission(_ context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	f.mutateCalls = append(f.mutateCalls, req)
	return f.mutateResp, f.mutateErr
}

var _ PluginClient = (*fakePluginClient)(nil)

func newAdmissionTestBuilder(client PluginClient, items ...pluginschema.StoredObject) *AppPluginAPIBuilder {
	b := &AppPluginAPIBuilder{
		pluginJSON:   plugins.JSONData{ID: "my-app"},
		groupVersion: schema.GroupVersion{Group: "my-app", Version: "v0alpha1"},
		client:       client,
		schemas: map[string]*pluginschema.PluginSchema{
			"v0alpha1": {
				TargetAPIVersion: "v0alpha1",
				StoredObjects:    &pluginschema.StoredObjectList{Items: items},
			},
		},
		pluginContextFn: func(ctx context.Context) (context.Context, backend.PluginContext, error) {
			return ctx, backend.PluginContext{PluginID: "my-app"}, nil
		},
	}
	return b
}

func watchlistStoredObject() pluginschema.StoredObject {
	return pluginschema.StoredObject{
		Name:       "Watchlist",
		Plural:     "watchlists",
		Singular:   "watchlist",
		Spec:       objectSchema(),
		Validation: []pluginschema.Operation{pluginschema.OperationCreate},
		Mutation:   []pluginschema.Operation{pluginschema.OperationCreate},
	}
}

func newWatchlist(spec map[string]any) *storedObject {
	obj := &storedObject{}
	obj.APIVersion = "my-app/v0alpha1"
	obj.Kind = "Watchlist"
	obj.Name = "watchlist-1"
	obj.Namespace = "default"
	obj.Spec = spec
	return obj
}

func watchlistAttributes(obj *storedObject, kind string, op admission.Operation, subresource string) admission.Attributes {
	return admission.NewAttributesRecord(
		obj, nil,
		schema.GroupVersionKind{Group: "my-app", Version: "v0alpha1", Kind: kind},
		"default", "watchlist-1",
		schema.GroupVersionResource{Group: "my-app", Version: "v0alpha1", Resource: "watchlists"},
		subresource, op, nil, false, &user.DefaultInfo{Name: "tester"},
	)
}

func TestStoredObjectAdmission(t *testing.T) {
	ctx := context.Background()

	t.Run("non-stored-object kind passes through without calling the plugin", func(t *testing.T) {
		client := &fakePluginClient{}
		b := newAdmissionTestBuilder(client, watchlistStoredObject())
		a := watchlistAttributes(newWatchlist(nil), "Settings", admission.Create, "")

		require.NoError(t, b.Validate(ctx, a, nil))
		require.NoError(t, b.Mutate(ctx, a, nil))
		require.Empty(t, client.validateCalls)
		require.Empty(t, client.mutateCalls)
	})

	t.Run("operation not opted-in passes through", func(t *testing.T) {
		client := &fakePluginClient{}
		b := newAdmissionTestBuilder(client, watchlistStoredObject()) // only CREATE opted-in
		a := watchlistAttributes(newWatchlist(nil), "Watchlist", admission.Update, "")

		require.NoError(t, b.Validate(ctx, a, nil))
		require.NoError(t, b.Mutate(ctx, a, nil))
		require.Empty(t, client.validateCalls)
		require.Empty(t, client.mutateCalls)
	})

	t.Run("opted-in create calls ValidateAdmission", func(t *testing.T) {
		client := &fakePluginClient{validateResp: &backend.ValidationResponse{Allowed: true}}
		b := newAdmissionTestBuilder(client, watchlistStoredObject())
		a := watchlistAttributes(newWatchlist(map[string]any{"title": "outages"}), "Watchlist", admission.Create, "")

		require.NoError(t, b.Validate(ctx, a, nil))
		require.Len(t, client.validateCalls, 1)
		req := client.validateCalls[0]
		require.Equal(t, backend.AdmissionRequestCreate, req.Operation)
		require.Equal(t, "my-app", req.PluginContext.PluginID)
		require.Equal(t, "Watchlist", req.Kind.Kind)
		require.NotEmpty(t, req.ObjectBytes)
	})

	t.Run("denial maps to an error containing the plugin's message", func(t *testing.T) {
		client := &fakePluginClient{validateResp: &backend.ValidationResponse{
			Allowed: false,
			Result:  &backend.StatusResult{Message: "title is required"},
		}}
		b := newAdmissionTestBuilder(client, watchlistStoredObject())
		a := watchlistAttributes(newWatchlist(nil), "Watchlist", admission.Create, "")

		err := b.Validate(ctx, a, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "my-app")
		require.Contains(t, err.Error(), "title is required")
	})

	t.Run("mutate decodes returned ObjectBytes into the live object", func(t *testing.T) {
		mutated := []byte(`{
			"apiVersion": "my-app/v0alpha1",
			"kind": "Watchlist",
			"metadata": {"name": "watchlist-1", "namespace": "default"},
			"spec": {"title": "outages", "severity": "info"}
		}`)
		client := &fakePluginClient{mutateResp: &backend.MutationResponse{Allowed: true, ObjectBytes: mutated}}
		b := newAdmissionTestBuilder(client, watchlistStoredObject())
		live := newWatchlist(map[string]any{"title": "outages"})
		a := watchlistAttributes(live, "Watchlist", admission.Create, "")

		require.NoError(t, b.Mutate(ctx, a, nil))
		require.Len(t, client.mutateCalls, 1)
		require.Equal(t, "info", live.Spec["severity"])
	})

	t.Run("mutate denial maps to an error", func(t *testing.T) {
		client := &fakePluginClient{mutateResp: &backend.MutationResponse{
			Allowed: false,
			Result:  &backend.StatusResult{Message: "no thanks"},
		}}
		b := newAdmissionTestBuilder(client, watchlistStoredObject())
		a := watchlistAttributes(newWatchlist(nil), "Watchlist", admission.Create, "")

		err := b.Mutate(ctx, a, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "no thanks")
	})

	t.Run("subresource requests are skipped", func(t *testing.T) {
		client := &fakePluginClient{}
		b := newAdmissionTestBuilder(client, watchlistStoredObject())
		a := watchlistAttributes(newWatchlist(nil), "Watchlist", admission.Update, "status")

		require.NoError(t, b.Validate(ctx, a, nil))
		require.NoError(t, b.Mutate(ctx, a, nil))
		require.Empty(t, client.validateCalls)
		require.Empty(t, client.mutateCalls)
	})

	t.Run("parse error fails closed", func(t *testing.T) {
		client := &fakePluginClient{}
		// Missing plural/singular makes parseStoredObjects fail; admission
		// must deny rather than silently skip the plugin's checks.
		b := newAdmissionTestBuilder(client, pluginschema.StoredObject{Name: "Watchlist", Spec: objectSchema()})
		a := watchlistAttributes(newWatchlist(nil), "Watchlist", admission.Create, "")

		require.Error(t, b.Validate(ctx, a, nil))
		require.Error(t, b.Mutate(ctx, a, nil))
		require.Empty(t, client.validateCalls)
		require.Empty(t, client.mutateCalls)
	})
}
