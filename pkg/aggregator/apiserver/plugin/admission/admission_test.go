package admission_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	admissionv1 "k8s.io/api/admission/v1"
	v1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	example "k8s.io/apiserver/pkg/apis/example/v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/admission"
	"github.com/stretchr/testify/require"
)

func TestParseRequest(t *testing.T) {
	exampleObj := example.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: "example",
		},
		Spec: example.PodSpec{
			ServiceAccountName: "example",
		},
	}

	raw, err := json.Marshal(exampleObj)
	require.NoError(t, err)

	expectedAR := &admissionv1.AdmissionReview{
		TypeMeta: metav1.TypeMeta{
			Kind:       "AdmissionReview",
			APIVersion: admissionv1.SchemeGroupVersion.String(),
		},
		Request: &admissionv1.AdmissionRequest{
			UID:       "1234",
			Kind:      metav1.GroupVersionKind{Group: "example.k8s.io", Version: "v1", Kind: "Pod"},
			Resource:  metav1.GroupVersionResource{Group: "example.k8s.io", Version: "v1", Resource: "pods"},
			Operation: admissionv1.Create,
			UserInfo:  v1.UserInfo{},
			Object:    runtime.RawExtension{Raw: raw},
			OldObject: runtime.RawExtension{},
			DryRun:    new(bool),
		},
	}

	body, err := json.Marshal(expectedAR)
	require.NoError(t, err)

	t.Run("should parse request", func(t *testing.T) {
		req, err := http.NewRequest("POST", "/admission", bytes.NewBuffer(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		ar, err := admission.ParseRequest(admission.GetCodecs(), req)
		if err != nil {
			t.Fatalf("failed to parse request: %v", err)
		}

		require.Equal(t, expectedAR, ar)
	})
}

func TestToAdmissionRequest(t *testing.T) {
	pluginCtx := backend.PluginContext{}
	admissionReview := &admissionv1.AdmissionReview{
		Request: &admissionv1.AdmissionRequest{
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

	expectedAdmissionRequest := &backend.AdmissionRequest{
		PluginContext:  pluginCtx,
		Operation:      backend.AdmissionRequestUpdate,
		Kind:           backend.GroupVersionKind{Group: "example.k8s.io", Version: "v1", Kind: "Pod"},
		ObjectBytes:    []byte(`{"foo":"bar"}`),
		OldObjectBytes: []byte(`{"bar":"foo"}`),
	}

	admissionRequest, err := admission.ToAdmissionRequest(pluginCtx, admissionReview)
	require.NoError(t, err)
	require.Equal(t, expectedAdmissionRequest, admissionRequest)
}
