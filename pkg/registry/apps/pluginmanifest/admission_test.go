package pluginmanifest

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	jsonpatch "gomodules.xyz/jsonpatch/v2"
	admissionv1beta1 "k8s.io/api/admission/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// decodeReviewRequest decodes the AdmissionReview the proxy POSTs, records its request on the
// fakeClient as lastReq (so assertions can inspect operation, kind, object, etc.), and returns it.
func decodeReviewRequest(c *fakeClient, req *backend.CallResourceRequest) (*admissionv1beta1.AdmissionRequest, error) {
	var review admissionv1beta1.AdmissionReview
	if err := json.Unmarshal(req.Body, &review); err != nil {
		return nil, err
	}
	c.lastReq = review.Request
	return review.Request, nil
}

// reviewResponse marshals an AdmissionReview carrying the given response into a CallResourceResponse.
func reviewResponse(resp *admissionv1beta1.AdmissionResponse) func(backend.CallResourceResponseSender) error {
	return func(sender backend.CallResourceResponseSender) error {
		body, err := json.Marshal(&admissionv1beta1.AdmissionReview{Response: resp})
		if err != nil {
			return err
		}
		return sender.Send(&backend.CallResourceResponse{Status: http.StatusOK, Body: body})
	}
}

// validateResponder returns a callResource func that decodes the AdmissionReview request and
// replies with an AdmissionReview whose response carries the given allowed/result.
func validateResponder(c *fakeClient, allowed bool, result *metav1.Status) func(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender) error {
	return func(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
		if _, err := decodeReviewRequest(c, req); err != nil {
			return err
		}
		return reviewResponse(&admissionv1beta1.AdmissionResponse{Allowed: allowed, Result: result})(sender)
	}
}

// mutateResponder returns a callResource func that decodes the AdmissionReview request and, when
// mutated is non-nil, replies with a JSONPatch transforming the incoming object into mutated.
func mutateResponder(c *fakeClient, allowed bool, result *metav1.Status, mutated *manifestObject) func(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender) error {
	return func(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
		areq, err := decodeReviewRequest(c, req)
		if err != nil {
			return err
		}
		resp := &admissionv1beta1.AdmissionResponse{Allowed: allowed, Result: result}
		if mutated != nil {
			mutatedBytes, err := json.Marshal(mutated)
			if err != nil {
				return err
			}
			ops, err := jsonpatch.CreatePatch(areq.Object.Raw, mutatedBytes)
			if err != nil {
				return err
			}
			patch, err := json.Marshal(ops)
			if err != nil {
				return err
			}
			pt := admissionv1beta1.PatchTypeJSONPatch
			resp.Patch = patch
			resp.PatchType = &pt
		}
		return reviewResponse(resp)(sender)
	}
}

// fakeClient implements plugins.Client (backend.Handler) but only the resource method matters.
// Both validating and mutating admission now go through CallResource ("/validate" and "/mutate")
// using the kubernetes AdmissionReview wire format, so the fake only needs the callResource hook.
type fakeClient struct {
	backend.BaseHandler
	callResource func(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender) error
	lastReq      *admissionv1beta1.AdmissionRequest
	lastCRReq    *backend.CallResourceRequest
	crCalled     bool
}

func (c *fakeClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	c.crCalled = true
	c.lastCRReq = req
	return c.callResource(ctx, req, sender)
}

type fakeContextGetter struct {
	err error
}

func (f fakeContextGetter) Get(_ context.Context, _ string, _ identity.Requester, _ int64) (backend.PluginContext, error) {
	return backend.PluginContext{}, f.err
}

// newTestApp builds a pluginBackendApp wired to the given fake client via the production
// constructor, so tests exercise the same construction path as ProvideAppInstallers.
func newTestApp(c *fakeClient) *pluginBackendApp {
	return newPluginBackendApp("test-app", c, fakeContextGetter{})
}

func newThing(specFoo string) *manifestObject {
	o := &manifestObject{}
	o.APIVersion = "testapp.ext.grafana.com/v1"
	o.Kind = "Thing"
	o.Name = "thing-1"
	o.Namespace = "default"
	o.Spec = map[string]any{"foo": specFoo}
	return o
}

func newRequest(action resource.AdmissionAction, obj resource.Object) *app.AdmissionRequest {
	return &app.AdmissionRequest{
		Action:  action,
		Group:   "testapp.ext.grafana.com",
		Version: "v1",
		Kind:    "Thing",
		Object:  obj,
	}
}

func TestPluginBackendApp_Validate(t *testing.T) {
	t.Run("allowed -> nil", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = validateResponder(c, true, nil)
		a := newTestApp(c)
		require.NoError(t, a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("ok"))))
	})

	t.Run("posts AdmissionReview to /validate path", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = validateResponder(c, true, nil)
		a := newTestApp(c)
		require.NoError(t, a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("ok"))))
		require.True(t, c.crCalled)
		require.Equal(t, "/validate", c.lastCRReq.Path)
		require.Equal(t, http.MethodPost, c.lastCRReq.Method)
		// The body decodes as a kube AdmissionReview, not a backend.AdmissionRequest.
		require.NotNil(t, c.lastReq)
		require.Equal(t, admissionv1beta1.Create, c.lastReq.Operation)
		require.Equal(t, "Thing", c.lastReq.Kind.Kind)
	})

	t.Run("denied -> error with message", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = validateResponder(c, false, &metav1.Status{Message: "dummy is forbidden"})
		a := newTestApp(c)
		err := a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("forbidden")))
		require.Error(t, err)
		require.Contains(t, err.Error(), "dummy is forbidden")
	})

	t.Run("backend error -> returned", func(t *testing.T) {
		boom := errors.New("backend boom")
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			return boom
		}}
		a := newTestApp(c)
		err := a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("ok")))
		require.ErrorIs(t, err, boom)
	})

	t.Run("error status -> error", func(t *testing.T) {
		c := &fakeClient{callResource: func(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			return sender.Send(&backend.CallResourceResponse{Status: http.StatusInternalServerError, Body: []byte("kaboom")})
		}}
		a := newTestApp(c)
		err := a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("ok")))
		require.Error(t, err)
		require.Contains(t, err.Error(), "kaboom")
	})

	t.Run("plugin context error -> clean error, no panic", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = validateResponder(c, true, nil)
		a := newPluginBackendApp("test-app", c, fakeContextGetter{err: errors.New("not registered")})
		err := a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("ok")))
		require.Error(t, err)
		require.Contains(t, err.Error(), "not registered")
	})

	t.Run("object raw carries the full envelope", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = validateResponder(c, true, nil)
		a := newTestApp(c)
		require.NoError(t, a.Validate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("hi"))))

		var envelope map[string]any
		require.NoError(t, json.Unmarshal(c.lastReq.Object.Raw, &envelope))
		require.Equal(t, "testapp.ext.grafana.com/v1", envelope["apiVersion"])
		require.Equal(t, "Thing", envelope["kind"])
		require.NotNil(t, envelope["metadata"])
		spec, ok := envelope["spec"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "hi", spec["foo"])
	})
}

func TestPluginBackendApp_ActionMapping(t *testing.T) {
	cases := []struct {
		action resource.AdmissionAction
		expect admissionv1beta1.Operation
	}{
		{resource.AdmissionActionCreate, admissionv1beta1.Create},
		{resource.AdmissionActionUpdate, admissionv1beta1.Update},
		{resource.AdmissionActionDelete, admissionv1beta1.Delete},
		{resource.AdmissionActionConnect, admissionv1beta1.Connect},
	}
	for _, tc := range cases {
		t.Run(string(tc.action), func(t *testing.T) {
			c := &fakeClient{}
			c.callResource = validateResponder(c, true, nil)
			a := newTestApp(c)
			require.NoError(t, a.Validate(context.Background(), newRequest(tc.action, newThing("ok"))))
			require.Equal(t, tc.expect, c.lastReq.Operation)
		})
	}
}

func TestPluginBackendApp_Mutate(t *testing.T) {
	t.Run("applies returned patch and round-trips object as *manifestObject", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = mutateResponder(c, true, nil, newThing("mutated"))
		a := newTestApp(c)

		resp, err := a.Mutate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("original")))
		require.NoError(t, err)
		require.NotNil(t, resp)
		// The updated object MUST be a *manifestObject so the SDK's reflect-based copy into the
		// live object (also *manifestObject) does not panic.
		updated, ok := resp.UpdatedObject.(*manifestObject)
		require.True(t, ok, "UpdatedObject must be *manifestObject, got %T", resp.UpdatedObject)
		require.Equal(t, "mutated", updated.Spec["foo"])
	})

	t.Run("posts AdmissionReview to /mutate path", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = mutateResponder(c, true, nil, nil)
		a := newTestApp(c)
		_, err := a.Mutate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("x")))
		require.NoError(t, err)
		require.True(t, c.crCalled)
		require.Equal(t, "/mutate", c.lastCRReq.Path)
		require.Equal(t, http.MethodPost, c.lastCRReq.Method)
	})

	t.Run("denied -> error", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = mutateResponder(c, false, &metav1.Status{Message: "nope"}, nil)
		a := newTestApp(c)
		_, err := a.Mutate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("x")))
		require.Error(t, err)
		require.Contains(t, err.Error(), "nope")
	})

	t.Run("no patch -> empty response", func(t *testing.T) {
		c := &fakeClient{}
		c.callResource = mutateResponder(c, true, nil, nil)
		a := newTestApp(c)
		resp, err := a.Mutate(context.Background(), newRequest(resource.AdmissionActionCreate, newThing("x")))
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Nil(t, resp.UpdatedObject)
	})
}
