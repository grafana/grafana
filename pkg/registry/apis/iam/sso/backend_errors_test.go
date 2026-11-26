package sso

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/client-go/kubernetes/scheme"

	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
)

// backendDiagnostic mimics the driver/table text a backend failure carries.
const backendDiagnostic = "Error 1146 (42S02): Table 'hg_grafana_third.sso_setting' doesn't exist"

type failingSSOService struct {
	ssosettings.Service
	listErr error
	getErr  error
}

func (f *failingSSOService) List(context.Context) ([]*ssomodels.SSOSettings, error) {
	return nil, f.listErr
}

func (f *failingSSOService) GetForProviderWithRedactedSecrets(context.Context, string) (*ssomodels.SSOSettings, error) {
	return nil, f.getErr
}

// requireSanitizedResponse renders the store error the way the apiserver does
// and asserts the response body never carries the backend diagnostic.
func requireSanitizedResponse(t *testing.T, err error, code int) {
	t.Helper()
	require.Error(t, err)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/stacks-11/ssosettings", nil)
	responsewriters.ErrorNegotiated(err, scheme.Codecs, schema.GroupVersion{Version: "v1"}, w, req)
	require.Equal(t, code, w.Code)
	require.NotContains(t, w.Body.String(), "hg_grafana_third")
	require.NotContains(t, w.Body.String(), "sso_setting")
	require.NotContains(t, w.Body.String(), backendDiagnostic)
}

func TestLegacyStore_ListBackendErrorIsSanitized(t *testing.T) {
	store := NewLegacyStore(&failingSSOService{listErr: errors.New(backendDiagnostic)}, noop.NewTracerProvider().Tracer("test"))
	_, err := store.List(context.Background(), nil)
	requireSanitizedResponse(t, err, http.StatusInternalServerError)
}

func TestLegacyStore_GetBackendErrorIsSanitized(t *testing.T) {
	store := NewLegacyStore(&failingSSOService{getErr: errors.New(backendDiagnostic)}, noop.NewTracerProvider().Tracer("test"))
	_, err := store.Get(context.Background(), "github", nil)
	requireSanitizedResponse(t, err, http.StatusInternalServerError)
}

func TestLegacyStore_GetNotFoundIsPreserved(t *testing.T) {
	store := NewLegacyStore(&failingSSOService{getErr: ssosettings.ErrNotFound}, noop.NewTracerProvider().Tracer("test"))
	_, err := store.Get(context.Background(), "github", nil)
	require.True(t, apierrors.IsNotFound(err))
	requireSanitizedResponse(t, err, http.StatusNotFound)
}

func TestMTSettingsStore_ListBackendErrorIsSanitized(t *testing.T) {
	f := newFakeSettings()
	f.listErr = errors.New(backendDiagnostic)
	_, err := NewMTSettingsStore(f, f, nil).List(nsCtx(), nil)
	requireSanitizedResponse(t, err, http.StatusInternalServerError)
}

func TestMTSettingsStore_GetBackendErrorIsSanitized(t *testing.T) {
	f := newFakeSettings()
	f.listErr = errors.New(backendDiagnostic)
	_, err := NewMTSettingsStore(f, f, nil).Get(nsCtx(), "github", &metav1.GetOptions{})
	requireSanitizedResponse(t, err, http.StatusInternalServerError)
}

// The MT-Settings client wraps every failure with fmt.Errorf("request failed: %w"),
// so the leaking error is never the outer one. The sanitizer must classify the
// outer error the way the apiserver does, not unwrap the chain.
func TestMTSettingsStore_WrappedStatusErrorIsSanitized(t *testing.T) {
	f := newFakeSettings()
	f.listErr = fmt.Errorf("request failed: %w", apierrors.NewInternalError(errors.New(backendDiagnostic)))
	_, err := NewMTSettingsStore(f, f, nil).List(nsCtx(), nil)
	requireSanitizedResponse(t, err, http.StatusInternalServerError)
}

func TestBackendError_PreservesTypedErrors(t *testing.T) {
	gr := schema.GroupResource{Group: "iam.grafana.app", Resource: "ssosettings"}
	for _, tc := range []struct {
		name string
		err  error
	}{
		{"not found", apierrors.NewNotFound(gr, "github")},
		{"bad request", apierrors.NewBadRequest("bad")},
		{"conflict", apierrors.NewConflict(gr, "github", errors.New("conflict"))},
		{"not implemented", apierrors.NewGenericServerResponse(http.StatusNotImplemented, "get", gr, "github", "nope", 0, false)},
		{"errutil not found", ssosettings.ErrNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.err, backendError(context.Background(), tc.err))
		})
	}
}
