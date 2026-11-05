package bootstrap

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/util/retry"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
)

// managerIdentity marks resources owned by the provisioning file bootstrap.
const managerIdentity = "file-provisioning"

// secureDigestAnnotation records a digest of the secure values the manifest last applied, so a
// reapplied manifest replays secure.*.create only when the value really changed. Replaying it
// unconditionally rotates the secret, and for an OAuth Connection also drops its authorized token.
const secureDigestAnnotation = "provisioning.grafana.app/bootstrap-secure-digest"

// Only Repository and Connection are managed here. Once a Repository is configured, Git Sync
// provisions the remaining resources (dashboards, folders, …) from the repository itself, so other
// kinds are intentionally rejected. Keyed by GroupKind so a same-named kind from an unrelated API
// group is skipped rather than sent to the provisioning API.
var (
	repositoryGVK = provisioning.RepositoryResourceInfo.GroupVersionKind()
	connectionGVK = provisioning.ConnectionResourceInfo.GroupVersionKind()

	supportedGVRs = map[schema.GroupKind]schema.GroupVersionResource{
		repositoryGVK.GroupKind(): provisioning.RepositoryResourceInfo.GroupVersionResource(),
		connectionGVK.GroupKind(): provisioning.ConnectionResourceInfo.GroupVersionResource(),
	}
)

// kindPriority orders applies so that resources referenced by others are created first.
// Connections must exist before the Repositories that reference them.
func kindPriority(kind string) int {
	if kind == connectionGVK.Kind {
		return 0
	}
	return 10
}

// Applier applies provisioning Repository and Connection manifests via the dynamic client.
//
// It uses unstructured objects rather than the typed client on purpose: the typed
// common.RawSecureValue redacts secrets when marshalled, so a typed write would persist
// "[REDACTED]" instead of the real token. The dynamic client sends the manifest JSON verbatim,
// letting the admission mutator encrypt the real value.
type Applier struct {
	dyn    dynamic.Interface
	logger log.Logger
}

// NewApplier builds an Applier from a dynamic client.
func NewApplier(dyn dynamic.Interface, logger log.Logger) *Applier {
	return &Applier{dyn: dyn, logger: logger}
}

// Apply applies every object, connections first. A failure on a single object is logged and
// skipped — it never aborts the batch, so one bad manifest cannot block the rest.
func (a *Applier) Apply(ctx context.Context, objs []*unstructured.Unstructured) {
	ordered := make([]*unstructured.Unstructured, len(objs))
	copy(ordered, objs)
	sort.SliceStable(ordered, func(i, j int) bool {
		return kindPriority(ordered[i].GetKind()) < kindPriority(ordered[j].GetKind())
	})

	for _, obj := range ordered {
		if err := a.applyOne(ctx, obj); err != nil {
			a.logger.Error("failed to apply bootstrap manifest",
				"kind", obj.GetKind(), "name", obj.GetName(), "namespace", obj.GetNamespace(), "error", err)
		}
	}
}

func (a *Applier) applyOne(ctx context.Context, obj *unstructured.Unstructured) error {
	gv, err := schema.ParseGroupVersion(obj.GetAPIVersion())
	if err != nil {
		return fmt.Errorf("parse apiVersion %q: %w", obj.GetAPIVersion(), err)
	}

	gvr, ok := supportedGVRs[gv.WithKind(obj.GetKind()).GroupKind()]
	if !ok {
		a.logger.Warn("skipping unsupported bootstrap manifest: provisioning bootstrap only manages Repository and Connection",
			"apiVersion", obj.GetAPIVersion(), "kind", obj.GetKind(), "name", obj.GetName())
		return nil
	}
	if gv.Version != gvr.Version {
		return fmt.Errorf("unsupported apiVersion %q: this Grafana serves %s", obj.GetAPIVersion(), gvr.GroupVersion())
	}

	ri := a.dyn.Resource(gvr).Namespace(obj.GetNamespace())

	// Another replica can patch status between the read and the write. Each attempt re-reads, so
	// the ownership check and status merge are redone against the object the update will replace.
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		return a.applyAttempt(ctx, gvr, ri, obj.DeepCopy())
	})
}

func (a *Applier) applyAttempt(ctx context.Context, gvr schema.GroupVersionResource, ri dynamic.ResourceInterface, obj *unstructured.Unstructured) error {
	name := obj.GetName()

	existing, getErr := ri.Get(ctx, name, metav1.GetOptions{})
	if getErr != nil && !apierrors.IsNotFound(getErr) {
		return fmt.Errorf("get existing: %w", getErr)
	}

	// Stamp ownership so the resource is reconciled on future boots and surfaced as managed in the UI.
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("read metadata: %w", err)
	}
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:        utils.ManagerKindFileProvisioning,
		Identity:    managerIdentity,
		AllowsEdits: false,
	})
	digest := secureDigest(obj)
	setAnnotation(obj, secureDigestAnnotation, digest)

	if apierrors.IsNotFound(getErr) {
		// Status is owned by controllers and rejected on create; never send it.
		unstructured.RemoveNestedField(obj.Object, "status")
		if _, err := ri.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
			if apierrors.IsAlreadyExists(err) {
				// Another replica created it between the read and the write; retry into the update path.
				return apierrors.NewConflict(gvr.GroupResource(), name, err)
			}
			return fmt.Errorf("create: %w", err)
		}
		a.logger.Info("created bootstrap manifest", "kind", obj.GetKind(), "name", name, "namespace", obj.GetNamespace())
		return nil
	}

	// Respect existing ownership: never steal a resource managed by something else.
	if mgr, ok := getManager(existing); ok && mgr.Identity != managerIdentity {
		a.logger.Warn("skipping bootstrap manifest: resource is managed by another manager",
			"kind", obj.GetKind(), "name", name, "namespace", obj.GetNamespace(), "managedBy", mgr.Kind, "managerId", mgr.Identity)
		return nil
	}

	// Unchanged secrets are dropped so admission keeps the stored references instead of re-creating
	// them; a changed manifest value still rotates.
	if digest != "" && digest == existing.GetAnnotations()[secureDigestAnnotation] {
		removeSecureCreates(obj)
	}

	// Reconcile spec+secure while preserving controller-owned status.
	obj.SetResourceVersion(existing.GetResourceVersion())
	if status, found, _ := unstructured.NestedMap(existing.Object, "status"); found {
		_ = unstructured.SetNestedMap(obj.Object, status, "status")
	} else {
		unstructured.RemoveNestedField(obj.Object, "status")
	}
	if _, err := ri.Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update: %w", err)
	}
	a.logger.Info("reconciled bootstrap manifest", "kind", obj.GetKind(), "name", name, "namespace", obj.GetNamespace())
	return nil
}

func getManager(obj *unstructured.Unstructured) (utils.ManagerProperties, bool) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return utils.ManagerProperties{}, false
	}
	return meta.GetManagerProperties()
}

func setAnnotation(obj *unstructured.Unstructured, key, value string) {
	if value == "" {
		return
	}
	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[key] = value
	obj.SetAnnotations(annotations)
}

// secureDigest hashes the inline secret values the manifest asks to create, or returns "" when it
// asks to create none. The resource identity is mixed in so the digest cannot be used to recognise
// the same secret on another instance.
func secureDigest(obj *unstructured.Unstructured) string {
	secure, found, _ := unstructured.NestedMap(obj.Object, "secure")
	if !found {
		return ""
	}

	keys := make([]string, 0, len(secure))
	for key := range secure {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	hash := sha256.New()
	_, _ = fmt.Fprintf(hash, "%s/%s\n", obj.GetNamespace(), obj.GetName())
	creates := 0
	for _, key := range keys {
		entry, ok := secure[key].(map[string]any)
		if !ok {
			continue
		}
		create, ok := entry["create"].(string)
		if !ok {
			continue
		}
		_, _ = fmt.Fprintf(hash, "%s=%s\n", key, create)
		creates++
	}
	if creates == 0 {
		return ""
	}
	return hex.EncodeToString(hash.Sum(nil))
}

// removeSecureCreates drops every secure.<key>.create directive, leaving any explicit reference in
// place. An entry that held nothing else is removed, as is an emptied secure block.
func removeSecureCreates(obj *unstructured.Unstructured) {
	secure, found, _ := unstructured.NestedMap(obj.Object, "secure")
	if !found {
		return
	}

	for key, value := range secure {
		entry, ok := value.(map[string]any)
		if !ok {
			continue
		}
		delete(entry, "create")
		if len(entry) == 0 {
			delete(secure, key)
			continue
		}
		secure[key] = entry
	}

	if len(secure) == 0 {
		unstructured.RemoveNestedField(obj.Object, "secure")
		return
	}
	_ = unstructured.SetNestedMap(obj.Object, secure, "secure")
}
