package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/util"
)

const maxLifecycleRequestBytes = 64 * 1024

// lifecycle subresources: POST …/dashboards/{name}/fork|publish|merge|rebase.
// They are the only way to create forks, publish drafts, and merge forks, so the
// lifecycle metadata (owner, fork-of, fork-base) can't be forged by a regular save.
func (b *DashboardsAPIBuilder) registerLifecycleSubresources(storage map[string]rest.Storage, info utils.ResourceInfo, store grafanarest.Storage) {
	for _, op := range []lifecycleOperation{lifecycleFork, lifecyclePublish, lifecycleMerge, lifecycleRebase} {
		storage[info.StoragePath(string(op))] = &lifecycleConnector{builder: b, store: store, resource: info.GroupResource(), op: op}
	}
}

type lifecycleOperation string

const (
	lifecycleFork    lifecycleOperation = "fork"
	lifecyclePublish lifecycleOperation = "publish"
	lifecycleMerge   lifecycleOperation = "merge"
	lifecycleRebase  lifecycleOperation = "rebase"
)

type lifecycleConnector struct {
	builder  *DashboardsAPIBuilder
	store    grafanarest.Storage
	resource schema.GroupResource
	op       lifecycleOperation
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

// lifecycleRequest is the union of the request bodies; each operation reads its own fields.
type lifecycleRequest struct {
	// Message is stored as the version message of the write.
	Message string `json:"message,omitempty"`
	// Fork: product that created the fork and a link back to it (display only).
	Origin    string `json:"origin,omitempty"`
	OriginRef string `json:"originRef,omitempty"`
	// Fork: idempotency token; a retried fork with the same token returns the same fork.
	ClientToken string `json:"clientToken,omitempty"`
	// Publish: destination folder and optional new title.
	Folder *string `json:"folder,omitempty"`
	Title  string  `json:"title,omitempty"`
	// Merge: overwrite the original even if it changed since the fork base.
	Force bool `json:"force,omitempty"`
	// Rebase: the original generation the fork's content now reflects.
	BaseGeneration int64 `json:"baseGeneration,omitempty"`
}

const annoKeyForkClientToken = "grafana.app/fork-client-token"

func (c *lifecycleConnector) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if !draftsAndForksEnabled(ctx) {
			responder.Error(apierrors.NewForbidden(c.resource, name, fmt.Errorf("dashboard drafts and forks are not enabled")))
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
		var (
			obj  runtime.Object
			code = http.StatusOK
		)
		switch c.op {
		case lifecycleFork:
			obj, err = c.fork(ctx, name, body)
			code = http.StatusCreated
		case lifecyclePublish:
			obj, err = c.publish(ctx, name, body)
		case lifecycleMerge:
			obj, err = c.merge(ctx, name, body)
		case lifecycleRebase:
			obj, err = c.rebase(ctx, name, body)
		}
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(code, obj)
	}), nil
}

func (c *lifecycleConnector) badRequest(name, msg string) error {
	return apierrors.NewBadRequest(fmt.Sprintf("%s %q: %s", c.resource.Resource, name, msg))
}

// serviceContext runs storage calls as Grafana itself after the connector has checked
// the requester's ownership and permissions. Viewers own their forks without having
// write access to the folder the fork lives in.
func serviceContext(ctx context.Context) (context.Context, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return identity.WithServiceIdentityContext(ctx, ns.OrgID), nil
}

// loadOwned loads a draft or fork the requester owns (or administers).
func (c *lifecycleConnector) loadOwned(ctx context.Context, name, lifecycle string) (runtime.Object, utils.GrafanaMetaAccessor, error) {
	obj, err := c.store.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, nil, err
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, nil, err
	}
	if lifecycleOf(meta) != lifecycle {
		return nil, nil, c.badRequest(name, "is not a "+lifecycle)
	}
	return obj, meta, nil
}

func (c *lifecycleConnector) fork(ctx context.Context, name string, body lifecycleRequest) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	owner, err := lifecycleOwnerID(user)
	if err != nil {
		return nil, err
	}
	// Read as the requester: forking needs read access to the original.
	original, err := c.store.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	origMeta, err := utils.MetaAccessor(original)
	if err != nil {
		return nil, err
	}
	if isPrivateLifecycle(origMeta) {
		return nil, c.badRequest(name, "only published dashboards can be forked")
	}

	svcCtx, err := serviceContext(ctx)
	if err != nil {
		return nil, err
	}
	if body.ClientToken != "" {
		if existing, err := c.findForkByToken(svcCtx, name, owner, body.ClientToken); err != nil || existing != nil {
			return existing, err
		}
	}

	fork, err := copyObjectForCreate(original)
	if err != nil {
		return nil, err
	}
	forkMeta, err := utils.MetaAccessor(fork)
	if err != nil {
		return nil, err
	}
	forkMeta.SetName(util.GenerateShortUID())
	forkMeta.SetFolder(origMeta.GetFolder())
	labels := forkMeta.GetLabels()
	labels[utils.LabelKeyLifecycle] = utils.LifecycleFork
	labels[utils.LabelKeyLifecycleOwner] = owner
	labels[utils.LabelKeyForkOf] = name
	forkMeta.SetLabels(labels)
	annotations := forkMeta.GetAnnotations()
	annotations[utils.AnnoKeyForkBase] = strconv.FormatInt(origMeta.GetGeneration(), 10)
	setOptional(annotations, utils.AnnoKeyOrigin, body.Origin)
	setOptional(annotations, utils.AnnoKeyOriginRef, body.OriginRef)
	setOptional(annotations, annoKeyForkClientToken, body.ClientToken)
	annotations[utils.AnnoKeyMessage] = messageOr(body.Message, fmt.Sprintf("Forked from %q", origMeta.FindTitle(name)))
	forkMeta.SetAnnotations(annotations)

	created, err := c.store.Create(svcCtx, fork, nil, &metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	createdMeta, err := utils.MetaAccessor(created)
	if err != nil {
		return nil, err
	}
	if err := c.builder.grantLifecycleOwnerAccess(ctx, createdMeta, user); err != nil {
		// The fork exists but its owner can't edit it; remove it rather than leave it unusable.
		_, _, _ = c.store.Delete(svcCtx, createdMeta.GetName(), nil, &metav1.DeleteOptions{})
		return nil, fmt.Errorf("granting fork owner access: %w", err)
	}
	return created, nil
}

func (c *lifecycleConnector) findForkByToken(ctx context.Context, original, owner, token string) (runtime.Object, error) {
	selector := labels.SelectorFromSet(labels.Set{
		utils.LabelKeyLifecycle:      utils.LifecycleFork,
		utils.LabelKeyLifecycleOwner: owner,
		utils.LabelKeyForkOf:         original,
	})
	list, err := c.store.List(ctx, &metainternalversion.ListOptions{LabelSelector: selector})
	if err != nil {
		return nil, err
	}
	items, err := apimeta.ExtractList(list)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		meta, err := utils.MetaAccessor(item)
		if err == nil && meta.GetAnnotations()[annoKeyForkClientToken] == token {
			return item, nil
		}
	}
	return nil, nil
}

func (c *lifecycleConnector) publish(ctx context.Context, name string, body lifecycleRequest) (runtime.Object, error) {
	draft, meta, err := c.loadOwned(ctx, name, utils.LifecycleDraft)
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
	labels := updatedMeta.GetLabels()
	labels[utils.LabelKeyLifecycle] = utils.LifecyclePublished
	delete(labels, utils.LabelKeyLifecycleOwner)
	updatedMeta.SetLabels(labels)
	annotations := updatedMeta.GetAnnotations()
	annotations[utils.AnnoKeyMessage] = messageOr(body.Message, "Published")
	updatedMeta.SetAnnotations(annotations)
	if body.Folder != nil {
		updatedMeta.SetFolder(*body.Folder)
	}
	// Write as the requester: publishing into a folder needs the regular permissions there.
	obj, _, err := c.store.Update(ctx, meta.GetName(), rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	return obj, err
}

func (c *lifecycleConnector) merge(ctx context.Context, name string, body lifecycleRequest) (runtime.Object, error) {
	fork, forkMeta, err := c.loadOwned(ctx, name, utils.LifecycleFork)
	if err != nil {
		return nil, err
	}
	originalName := forkMeta.GetLabels()[utils.LabelKeyForkOf]
	base, ok := forkBaseOf(forkMeta)
	if originalName == "" || !ok {
		return nil, c.badRequest(name, "fork metadata is incomplete")
	}
	// Read and write the original as the requester: merging needs edit access to it.
	original, err := c.store.Get(ctx, originalName, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	origMeta, err := utils.MetaAccessor(original)
	if err != nil {
		return nil, err
	}
	if manager, ok := origMeta.GetManagerProperties(); ok && !manager.AllowsEdits {
		return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusUnprocessableEntity,
			Reason:  metav1.StatusReasonInvalid,
			Message: fmt.Sprintf("the original dashboard is managed by %s and can't be changed here", manager.Kind),
			Details: &metav1.StatusDetails{Name: originalName, Causes: []metav1.StatusCause{{Type: "managed", Message: string(manager.Kind)}}},
		}}
	}
	if origMeta.GetGeneration() != base && !body.Force {
		return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusConflict,
			Reason:  metav1.StatusReasonConflict,
			Message: fmt.Sprintf("the original dashboard changed since the fork was created (fork base %d, current %d)", base, origMeta.GetGeneration()),
			Details: &metav1.StatusDetails{
				Name:  originalName,
				Group: c.resource.Group,
				Kind:  c.resource.Resource,
				Causes: []metav1.StatusCause{
					{Type: "baseGeneration", Message: strconv.FormatInt(base, 10)},
					{Type: "currentGeneration", Message: strconv.FormatInt(origMeta.GetGeneration(), 10)},
				},
			},
		}}
	}

	forkSpec, err := specOf(fork)
	if err != nil {
		return nil, err
	}
	merged, err := copyObjectForUpdate(original, func(m map[string]any) { m["spec"] = forkSpec })
	if err != nil {
		return nil, err
	}
	mergedMeta, err := utils.MetaAccessor(merged)
	if err != nil {
		return nil, err
	}
	annotations := mergedMeta.GetAnnotations()
	annotations[utils.AnnoKeyMessage] = messageOr(body.Message, fmt.Sprintf("Merged fork %s", name))
	mergedMeta.SetAnnotations(annotations)
	result, _, err := c.store.Update(ctx, originalName, rest.DefaultUpdatedObjectInfo(merged), nil, nil, false, &metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}

	svcCtx, err := serviceContext(ctx)
	if err != nil {
		return nil, err
	}
	if _, _, err := c.store.Delete(svcCtx, name, nil, &metav1.DeleteOptions{}); err != nil {
		logging.FromContext(ctx).Warn("merged fork could not be moved to trash", "fork", name, "error", err)
	}
	return result, nil
}

func (c *lifecycleConnector) rebase(ctx context.Context, name string, body lifecycleRequest) (runtime.Object, error) {
	fork, forkMeta, err := c.loadOwned(ctx, name, utils.LifecycleFork)
	if err != nil {
		return nil, err
	}
	original, err := c.store.Get(ctx, forkMeta.GetLabels()[utils.LabelKeyForkOf], &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	origMeta, err := utils.MetaAccessor(original)
	if err != nil {
		return nil, err
	}
	if body.BaseGeneration <= 0 || body.BaseGeneration > origMeta.GetGeneration() {
		return nil, c.badRequest(name, fmt.Sprintf("baseGeneration must be between 1 and %d", origMeta.GetGeneration()))
	}
	updated, err := copyObjectForUpdate(fork, nil)
	if err != nil {
		return nil, err
	}
	updatedMeta, err := utils.MetaAccessor(updated)
	if err != nil {
		return nil, err
	}
	annotations := updatedMeta.GetAnnotations()
	annotations[utils.AnnoKeyForkBase] = strconv.FormatInt(body.BaseGeneration, 10)
	annotations[utils.AnnoKeyMessage] = messageOr(body.Message, fmt.Sprintf("Updated fork onto version %d", body.BaseGeneration))
	updatedMeta.SetAnnotations(annotations)
	svcCtx, err := serviceContext(ctx)
	if err != nil {
		return nil, err
	}
	obj, _, err := c.store.Update(svcCtx, name, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, &metav1.UpdateOptions{})
	return obj, err
}

// grantLifecycleOwnerAccess gives the owner admin on their fork. Forks live in the
// original's folder, where a viewer who forked has no write access.
func (b *DashboardsAPIBuilder) grantLifecycleOwnerAccess(ctx context.Context, obj utils.GrafanaMetaAccessor, user identity.Requester) error {
	svcCtx, err := serviceContext(ctx)
	if err != nil {
		return err
	}
	if b.isStandalone || b.iamFeatures.ResourcePermissionsAPI {
		client, err := b.resourcePermissionsClient(ctx)
		if err != nil {
			return err
		}
		if client == nil {
			return nil
		}
		kind := "User"
		if user.IsIdentityType(claims.TypeServiceAccount) {
			kind = "ServiceAccount"
		}
		gvr := dashv1.DashboardResourceInfo.GroupVersionResource()
		_, err = (*client).Namespace(obj.GetNamespace()).Create(svcCtx, &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name":      fmt.Sprintf("%s-%s-%s", gvr.Group, gvr.Resource, obj.GetName()),
				"namespace": obj.GetNamespace(),
			},
			"spec": map[string]any{
				"resource":    map[string]any{"apiGroup": gvr.Group, "resource": gvr.Resource, "name": obj.GetName()},
				"permissions": []map[string]any{{"kind": kind, "name": user.GetIdentifier(), "verb": "admin"}},
			},
		}}, metav1.CreateOptions{})
		return err
	}
	if b.dashboardPermissionsSvc == nil {
		return nil
	}
	internalID, err := user.GetInternalID()
	if err != nil {
		return err
	}
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return err
	}
	_, err = b.dashboardPermissionsSvc.SetUserPermission(svcCtx, ns.OrgID, accesscontrol.User{ID: internalID}, obj.GetName(), "Admin")
	return err
}

// copyObjectForCreate returns a copy of obj without identity, versioning, or
// provisioning metadata, ready to be created as a new resource.
func copyObjectForCreate(obj runtime.Object) (runtime.Object, error) {
	return roundTrip(obj, func(m map[string]any) {
		delete(m, "status")
		meta, _ := m["metadata"].(map[string]any)
		keep := map[string]any{}
		if labels, ok := meta["labels"].(map[string]any); ok {
			kept := map[string]any{}
			for k, v := range labels {
				if k != utils.LabelKeyDeprecatedInternalID {
					kept[k] = v
				}
			}
			keep["labels"] = kept
		} else {
			keep["labels"] = map[string]any{}
		}
		annotations := map[string]any{}
		if src, ok := meta["annotations"].(map[string]any); ok {
			if folder, ok := src[utils.AnnoKeyFolder]; ok {
				annotations[utils.AnnoKeyFolder] = folder
			}
		}
		keep["annotations"] = annotations
		if ns, ok := meta["namespace"]; ok {
			keep["namespace"] = ns
		}
		m["metadata"] = keep
	})
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

func specOf(obj runtime.Object) (any, error) {
	data, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return m["spec"], nil
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

func setOptional(m map[string]string, key, value string) {
	if value != "" {
		m[key] = value
	}
}

func messageOr(message, fallback string) string {
	if message != "" {
		return message
	}
	return fallback
}
