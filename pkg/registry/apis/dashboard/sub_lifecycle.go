package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

const maxLifecycleRequestBytes = 64 * 1024

// lifecycle subresources: POST …/dashboards/{name}/publish publishes a draft; it is the
// only way to, so the lifecycle metadata can't be forged by a regular save.
func (b *DashboardsAPIBuilder) registerLifecycleSubresources(storage map[string]rest.Storage, info utils.ResourceInfo, store grafanarest.Storage) {
	storage[info.StoragePath("publish")] = &lifecycleConnector{builder: b, store: store, resource: info.GroupResource()}
}

type lifecycleConnector struct {
	builder  *DashboardsAPIBuilder
	store    grafanarest.Storage
	resource schema.GroupResource
}

var (
	_ rest.Connecter       = (*lifecycleConnector)(nil)
	_ rest.StorageMetadata = (*lifecycleConnector)(nil)
)

func (c *lifecycleConnector) New() runtime.Object               { return c.store.New() }
func (c *lifecycleConnector) Destroy()                          {}
func (c *lifecycleConnector) ConnectMethods() []string          { return []string{http.MethodPost} }
func (c *lifecycleConnector) ProducesMIMETypes(string) []string { return []string{"application/json"} }
func (c *lifecycleConnector) ProducesObject(string) any         { return c.store.New() }
func (c *lifecycleConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// lifecycleRequest is the publish request body.
type lifecycleRequest struct {
	// Message is stored as the version message of the write.
	Message string `json:"message,omitempty"`
	// Destination folder and optional new title.
	Folder *string `json:"folder,omitempty"`
	Title  string  `json:"title,omitempty"`
}

func (c *lifecycleConnector) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if !draftsAndPendingChangesEnabled(ctx) {
			responder.Error(apierrors.NewForbidden(c.resource, name, fmt.Errorf("dashboard drafts are not enabled")))
			return
		}
		var body lifecycleRequest
		raw, err := io.ReadAll(io.LimitReader(req.Body, maxLifecycleRequestBytes))
		if err != nil {
			responder.Error(apierrors.NewBadRequest("could not read request body"))
			return
		}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &body); err != nil {
				responder.Error(apierrors.NewBadRequest("invalid request body: " + err.Error()))
				return
			}
		}
		obj, err := c.publish(ctx, name, body)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, obj)
	}), nil
}

func (c *lifecycleConnector) badRequest(name, msg string) error {
	return apierrors.NewBadRequest(fmt.Sprintf("%s %q: %s", c.resource.Resource, name, msg))
}

// loadDraft loads a draft the requester owns (or administers).
func (c *lifecycleConnector) loadDraft(ctx context.Context, name string) (runtime.Object, utils.GrafanaMetaAccessor, error) {
	obj, err := c.store.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, nil, err
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, nil, err
	}
	if lifecycleOf(meta) != utils.LifecycleDraft {
		return nil, nil, c.badRequest(name, "is not a draft")
	}
	return obj, meta, nil
}

func (c *lifecycleConnector) publish(ctx context.Context, name string, body lifecycleRequest) (runtime.Object, error) {
	draft, meta, err := c.loadDraft(ctx, name)
	if err != nil {
		return nil, err
	}
	updated, err := copyObjectForUpdate(draft, func(m map[string]any) {
		if body.Title != "" {
			if spec, ok := m["spec"].(map[string]any); ok {
				spec["title"] = body.Title
			}
		}
	})
	if err != nil {
		return nil, err
	}
	updatedMeta, err := utils.MetaAccessor(updated)
	if err != nil {
		return nil, err
	}
	labels := labelsOf(updatedMeta)
	labels[utils.LabelKeyLifecycle] = utils.LifecyclePublished
	delete(labels, utils.LabelKeyLifecycleOwner)
	updatedMeta.SetLabels(labels)
	annotations := annotationsOf(updatedMeta)
	annotations[utils.AnnoKeyMessage] = messageOr(body.Message, "Published")
	updatedMeta.SetAnnotations(annotations)
	if body.Folder != nil {
		updatedMeta.SetFolder(*body.Folder)
	}
	// Write as the requester: publishing into a folder needs the regular permissions there.
	obj, _, err := c.store.Update(ctx, meta.GetName(), rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	return obj, err
}

// copyObjectForUpdate returns a copy of obj (keeping its resourceVersion as the
// write precondition) after applying edit to its JSON form.
func copyObjectForUpdate(obj runtime.Object, edit func(map[string]any)) (runtime.Object, error) {
	return roundTrip(obj, func(m map[string]any) {
		if meta, ok := m["metadata"].(map[string]any); ok {
			if meta["labels"] == nil {
				meta["labels"] = map[string]any{}
			}
			if meta["annotations"] == nil {
				meta["annotations"] = map[string]any{}
			}
		}
		if edit != nil {
			edit(m)
		}
	})
}

func roundTrip(obj runtime.Object, edit func(map[string]any)) (runtime.Object, error) {
	data, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	edit(m)
	data, err = json.Marshal(m)
	if err != nil {
		return nil, err
	}
	out, ok := reflect.New(reflect.TypeOf(obj).Elem()).Interface().(runtime.Object)
	if !ok {
		return nil, fmt.Errorf("unexpected object type %T", obj)
	}
	if err := json.Unmarshal(data, out); err != nil {
		return nil, err
	}
	return out, nil
}

func labelsOf(obj utils.GrafanaMetaAccessor) map[string]string {
	if labels := obj.GetLabels(); labels != nil {
		return labels
	}
	return map[string]string{}
}

func annotationsOf(obj utils.GrafanaMetaAccessor) map[string]string {
	if annotations := obj.GetAnnotations(); annotations != nil {
		return annotations
	}
	return map[string]string{}
}

func messageOr(message, fallback string) string {
	if message != "" {
		return message
	}
	return fallback
}
