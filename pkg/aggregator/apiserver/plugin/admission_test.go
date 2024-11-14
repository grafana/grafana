package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	admissionv1 "k8s.io/api/admission/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/fakes"
)

func TestAdmissionMutation(t *testing.T) {
	dps := v0alpha1.DataPlaneService{
		Spec: v0alpha1.DataPlaneServiceSpec{
			PluginID: "testds",
			Group:    "testds.example.com",
			Version:  "v1",
			Services: []v0alpha1.Service{
				{
					Type: v0alpha1.AdmissionControlServiceType,
				},
			},
		},
	}

	pluginContext := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID: 1,
		},
	}
	contextProvider := &fakes.FakePluginContextProvider{
		PluginContext: pluginContext,
	}

	admissionReview := &admissionv1.AdmissionReview{
		TypeMeta: metav1.TypeMeta{
			Kind:       "AdmissionReview",
			APIVersion: admissionv1.SchemeGroupVersion.String(),
		},
		Request: &admissionv1.AdmissionRequest{
			UID:       "1234",
			Operation: admissionv1.Update,
			Kind: metav1.GroupVersionKind{
				Group:   "example.k8s.io",
				Version: "v1",
				Kind:    "Pod",
			},
			Object: runtime.RawExtension{
				Raw: []byte(`{"foo":"bar"}`),
			},
			OldObject: runtime.RawExtension{
				Raw: []byte(`{"bar":"foo"}`),
			},
		},
	}

	pluginRes := &backend.MutationResponse{
		Allowed:     true,
		ObjectBytes: []byte(`{"foo": "foo"}`),
	}

	jsonAdmissionReview, err := json.Marshal(admissionReview)
	require.NoError(t, err)

	pc := &fakes.FakePluginClient{
		MutateAdmissionFunc: newFakeMutateAdmissionHandler(pluginRes, nil),
	}

	delegate := fakes.NewFakeHTTPHandler(http.StatusNotFound, []byte(`Not Found`))
	handler := NewPluginHandler(pc, dps, contextProvider, delegate)

	t.Run("should return mutation response", func(t *testing.T) {
		req, err := http.NewRequest("POST", "/apis/testds.example.com/v1/admission/mutate", bytes.NewBuffer(jsonAdmissionReview))
		assert.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		pt := admissionv1.PatchTypeJSONPatch
		expectedRes := &admissionv1.AdmissionReview{
			TypeMeta: metav1.TypeMeta{
				Kind:       "AdmissionReview",
				APIVersion: admissionv1.SchemeGroupVersion.String(),
			},
			Response: &admissionv1.AdmissionResponse{
				UID:       admissionReview.Request.UID,
				Allowed:   true,
				Patch:     []byte(`[{"op":"replace","path":"/foo","value":"foo"}]`),
				PatchType: &pt,
			},
		}
		actualRes := &admissionv1.AdmissionReview{}
		assert.NoError(t, json.NewDecoder(rr.Body).Decode(actualRes))
		require.Equal(t, expectedRes, actualRes)
	})
}

func TestAdmissionValidation(t *testing.T) {
	dps := v0alpha1.DataPlaneService{
		Spec: v0alpha1.DataPlaneServiceSpec{
			PluginID: "testds",
			Group:    "testds.example.com",
			Version:  "v1",
			Services: []v0alpha1.Service{
				{
					Type: v0alpha1.AdmissionControlServiceType,
				},
			},
		},
	}

	pluginContext := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID: 1,
		},
	}
	contextProvider := &fakes.FakePluginContextProvider{
		PluginContext: pluginContext,
	}

	admissionReview := &admissionv1.AdmissionReview{
		TypeMeta: metav1.TypeMeta{
			Kind:       "AdmissionReview",
			APIVersion: admissionv1.SchemeGroupVersion.String(),
		},
		Request: &admissionv1.AdmissionRequest{
			UID:       "1234",
			Operation: admissionv1.Update,
			Kind: metav1.GroupVersionKind{
				Group:   "example.k8s.io",
				Version: "v1",
				Kind:    "Pod",
			},
			Object: runtime.RawExtension{
				Raw: []byte(`{"foo":"bar"}`),
			},
			OldObject: runtime.RawExtension{
				Raw: []byte(`{"bar":"foo"}`),
			},
		},
	}

	pluginRes := &backend.ValidationResponse{
		Allowed: false,
		Result: &backend.StatusResult{
			Status:  "Failure",
			Message: "message",
			Reason:  "NotFound",
			Code:    404,
		},
		Warnings: []string{"warning 1", "warning 2"},
	}

	jsonAdmissionReview, err := json.Marshal(admissionReview)
	require.NoError(t, err)

	pc := &fakes.FakePluginClient{
		ValidateAdmissionFunc: newFakeValidateAdmissionHandler(pluginRes, nil),
	}

	delegate := fakes.NewFakeHTTPHandler(http.StatusNotFound, []byte(`Not Found`))
	handler := NewPluginHandler(pc, dps, contextProvider, delegate)

	t.Run("should return validation response", func(t *testing.T) {
		req, err := http.NewRequest("POST", "/apis/testds.example.com/v1/admission/validate", bytes.NewBuffer(jsonAdmissionReview))
		assert.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		expectedRes := &admissionv1.AdmissionReview{
			TypeMeta: metav1.TypeMeta{
				Kind:       "AdmissionReview",
				APIVersion: admissionv1.SchemeGroupVersion.String(),
			},
			Response: &admissionv1.AdmissionResponse{
				UID:     admissionReview.Request.UID,
				Allowed: false,
				Result: &metav1.Status{
					Status:  metav1.StatusFailure,
					Message: "message",
					Reason:  metav1.StatusReasonNotFound,
					Code:    404,
				},
				Warnings: pluginRes.Warnings,
			},
		}
		actualRes := &admissionv1.AdmissionReview{}
		assert.NoError(t, json.NewDecoder(rr.Body).Decode(actualRes))
		require.Equal(t, expectedRes, actualRes)
	})
}

func newFakeMutateAdmissionHandler(response *backend.MutationResponse, err error) backend.MutateAdmissionFunc {
	return func(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
		return response, err
	}
}

func newFakeValidateAdmissionHandler(response *backend.ValidationResponse, err error) backend.ValidateAdmissionFunc {
	return func(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
		return response, err
	}
}
