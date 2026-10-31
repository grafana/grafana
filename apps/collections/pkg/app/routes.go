package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// starsUpdatePath is the subresource route, as the manifest declares it.
const starsUpdatePath = "update/{group}/{kind}/{id}"

// starsClient is what the update route needs of the stars API.
type starsClient interface {
	Create(ctx context.Context, obj *v1alpha1.Stars, opts resource.CreateOptions) (*v1alpha1.Stars, error)
	Update(ctx context.Context, obj *v1alpha1.Stars, opts resource.UpdateOptions) (*v1alpha1.Stars, error)
	Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error
}

type starsRoutes struct {
	client starsClient
}

type starItem struct {
	group, kind, id string
}

// update adds (PUT) or removes (DELETE) one starred item of the caller's own
// stars. The router has already authorized the caller for the named object and
// passes it as the parent; there is no parent while the user has no stars yet.
func (r *starsRoutes) update(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	if r.client == nil {
		return writeStatus(w, apierrors.NewServiceUnavailable("no connection to the API server is configured"))
	}
	ident := req.ResourceIdentifier

	owner, ok := utils.ParseOwnerFromName(ident.Name)
	if !ok || owner.Owner != utils.UserResourceOwner {
		return writeStatus(w, apierrors.NewBadRequest("only works with user stars"))
	}
	item, err := itemFromPath(req.URL.Path)
	if err != nil {
		return writeStatus(w, err)
	}
	var remove bool
	switch req.Method {
	case http.MethodPut:
	case http.MethodDelete:
		remove = true
	default:
		return writeStatus(w, apierrors.NewMethodNotSupported(schema.GroupResource{Group: v1alpha1.APIGroup, Resource: "stars"}, req.Method))
	}

	stars, err := parentStars(req.Parent)
	if err != nil {
		return writeStatus(w, err)
	}
	if stars == nil {
		if remove {
			return writeStatus(w, nil) // nothing to remove from
		}
		stars = &v1alpha1.Stars{ObjectMeta: metav1.ObjectMeta{Name: ident.Name, Namespace: ident.Namespace}}
	}

	if remove {
		stars.Spec.Remove(item.group, item.kind, item.id)
	} else {
		stars.Spec.Add(item.group, item.kind, item.id)
	}

	switch {
	case len(stars.Spec.Resource) == 0:
		err = r.client.Delete(ctx, resource.Identifier{Namespace: ident.Namespace, Name: ident.Name}, resource.DeleteOptions{})
	case stars.ResourceVersion == "":
		_, err = r.client.Create(ctx, stars, resource.CreateOptions{})
	default:
		_, err = r.client.Update(ctx, stars, resource.UpdateOptions{ResourceVersion: stars.ResourceVersion})
	}
	return writeStatus(w, err)
}

// parentStars is the stored object, or nil when there is none.
func parentStars(parent *app.RawObject) (*v1alpha1.Stars, error) {
	if parent == nil || len(parent.Raw) == 0 {
		return nil, nil
	}
	stars := &v1alpha1.Stars{}
	if err := json.Unmarshal(parent.Raw, stars); err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("reading the stars object: %w", err))
	}
	return stars, nil
}

// itemFromPath reads {group}/{kind}/{id} from after /update/ in a request path.
func itemFromPath(urlPath string) (starItem, error) {
	_, after, ok := strings.Cut(urlPath, "/update/")
	if !ok {
		return starItem{}, apierrors.NewBadRequest("invalid request path")
	}
	parts := strings.Split(strings.Trim(after, "/"), "/")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return starItem{}, apierrors.NewBadRequest("expected {group}/{kind}/{id}")
	}
	return starItem{group: parts[0], kind: parts[1], id: parts[2]}, nil
}

// writeStatus answers with a Status: a success for a nil error.
func writeStatus(w http.ResponseWriter, err error) error {
	status := metav1.Status{TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"}, Status: metav1.StatusSuccess, Code: http.StatusOK}
	if err != nil {
		if apiStatus, ok := err.(apierrors.APIStatus); ok { //nolint:errorlint // the status error is the error itself
			status = apiStatus.Status()
		} else {
			status = apierrors.NewInternalError(err).Status()
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(int(status.Code))
	return json.NewEncoder(w).Encode(status)
}
