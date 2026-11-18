package app

import (
	"context"
	"encoding/json"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
)

// mergedPath is the route that answers with the caller's preferences, merged.
// merged is a fixed name of the kind, so no object is stored under it.
const mergedPath = "preferences/merged"

// preferencesLister lists preferences as the caller. The host limits the list to
// the objects the caller owns, most specific first: their own, their teams' and
// the namespace's.
type preferencesLister interface {
	ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*v1.PreferencesList, error)
}

type mergedRoute struct {
	config *Config
	lister preferencesLister
}

func (r *mergedRoute) get(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	if r.lister == nil {
		return writeError(w, apierrors.NewServiceUnavailable("no connection to the API server is configured"))
	}
	list, err := r.lister.ListAll(ctx, req.ResourceIdentifier.Namespace, resource.ListOptions{})
	if err != nil {
		return writeError(w, err)
	}
	merged, err := r.config.Merge(list.Items)
	if err != nil {
		return writeError(w, err)
	}
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(merged)
}

func writeError(w http.ResponseWriter, err error) error {
	status := apierrors.NewInternalError(err).Status()
	if apiStatus, ok := err.(apierrors.APIStatus); ok { //nolint:errorlint // the status error is the error itself
		status = apiStatus.Status()
	}
	status.TypeMeta = metav1.TypeMeta{Kind: "Status", APIVersion: "v1"}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(int(status.Code))
	return json.NewEncoder(w).Encode(status)
}
