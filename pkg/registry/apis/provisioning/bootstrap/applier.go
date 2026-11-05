package bootstrap

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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

// secureDigestAnnotation holds a per-key digest of the secure values last applied from the manifest.
const secureDigestAnnotation = "provisioning.grafana.app/bootstrap-secure-digest"

// Keyed by GroupKind so a same-named kind from another group is skipped, not sent to provisioning.
var (
	repositoryGVK = provisioning.RepositoryResourceInfo.GroupVersionKind()
	connectionGVK = provisioning.ConnectionResourceInfo.GroupVersionKind()

	supportedResources = map[schema.GroupKind]string{
		repositoryGVK.GroupKind(): provisioning.RepositoryResourceInfo.GetName(),
		connectionGVK.GroupKind(): provisioning.ConnectionResourceInfo.GetName(),
	}

	// Both versions are registered as API builders and share the v0alpha1 Go types.
	servedVersions = map[string]bool{provisioning.VERSION: true, "v1beta1": true}
)

// kindPriority orders applies so that resources referenced by others are created first.
// Connections must exist before the Repositories that reference them.
func kindPriority(kind string) int {
	if kind == connectionGVK.Kind {
		return 0
	}
	return 10
}

// Applier applies Repository and Connection manifests via the dynamic client. Unstructured rather
// than typed on purpose: typed common.RawSecureValue redacts on marshal, so a typed write would
// persist "[REDACTED]" instead of the real token.
type Applier struct {
	dyn       dynamic.Interface
	digestKey []byte
	logger    log.Logger
}

// NewApplier builds an Applier. digestKey must be stable across restarts and replicas.
func NewApplier(dyn dynamic.Interface, digestKey []byte, logger log.Logger) *Applier {
	return &Applier{dyn: dyn, digestKey: digestKey, logger: logger}
}

// Apply applies every object, connections first. A single failure is logged, never fatal.
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

	resource, ok := supportedResources[gv.WithKind(obj.GetKind()).GroupKind()]
	if !ok {
		a.logger.Warn("skipping unsupported bootstrap manifest: provisioning bootstrap only manages Repository and Connection",
			"apiVersion", obj.GetAPIVersion(), "kind", obj.GetKind(), "name", obj.GetName())
		return nil
	}
	if !servedVersions[gv.Version] {
		return fmt.Errorf("unsupported apiVersion %q", obj.GetAPIVersion())
	}

	// Apply through the endpoint the manifest names, not a fixed one.
	gvr := gv.WithResource(resource)
	ri := a.dyn.Resource(gvr).Namespace(obj.GetNamespace())

	// Another replica can patch status between the read and the write, so each attempt re-reads.
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

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("read metadata: %w", err)
	}
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:        utils.ManagerKindFileProvisioning,
		Identity:    managerIdentity,
		AllowsEdits: false,
	})

	digests := a.secureDigests(obj)
	if len(digests) > 0 {
		annotations := obj.GetAnnotations()
		if annotations == nil {
			annotations = map[string]string{}
		}
		annotations[secureDigestAnnotation] = marshalDigests(digests)
		obj.SetAnnotations(annotations)
	}

	if apierrors.IsNotFound(getErr) {
		// Status is owned by controllers and rejected on create; never send it.
		unstructured.RemoveNestedField(obj.Object, "status")
		if _, err := ri.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
			if apierrors.IsAlreadyExists(err) {
				// Another replica won the create; retry into the update path.
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

	dropUnchangedSecureCreates(obj, existing, digests)

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

// dropUnchangedSecureCreates removes each secure.<key>.create the resource already holds, so
// admission keeps the stored reference: resending one drops an OAuth Connection's authorized token.
// The token is exempt on a URL change, which admission rejects without an explicit token.
func dropUnchangedSecureCreates(obj, existing *unstructured.Unstructured, digests map[string]string) {
	stored := parseDigests(existing.GetAnnotations()[secureDigestAnnotation])
	urlChanged := repositoryURL(obj) != repositoryURL(existing)

	for key, digest := range digests {
		if key == "token" && urlChanged {
			continue
		}
		if stored[key] == digest {
			removeSecureCreate(obj, key)
		}
	}
}

// repositoryURL mirrors Repository.URL(): the git URL lives under the type-specific spec block.
func repositoryURL(obj *unstructured.Unstructured) string {
	repoType, _, _ := unstructured.NestedString(obj.Object, "spec", "type")
	if repoType == "" {
		return ""
	}
	url, _, _ := unstructured.NestedString(obj.Object, "spec", repoType, "url")
	return url
}

// secureDigests returns one digest per secure.<key>.create. They are HMACs over the resource
// identity under a server-only key, since the annotation holding them is readable by viewers.
func (a *Applier) secureDigests(obj *unstructured.Unstructured) map[string]string {
	secure, found, _ := unstructured.NestedMap(obj.Object, "secure")
	if !found {
		return nil
	}

	digests := map[string]string{}
	for key, value := range secure {
		entry, ok := value.(map[string]any)
		if !ok {
			continue
		}
		create, ok := entry["create"].(string)
		if !ok {
			continue
		}
		mac := hmac.New(sha256.New, a.digestKey)
		_, _ = fmt.Fprintf(mac, "%s/%s/%s=%s", obj.GetNamespace(), obj.GetName(), key, create)
		digests[key] = hex.EncodeToString(mac.Sum(nil))
	}
	if len(digests) == 0 {
		return nil
	}
	return digests
}

func marshalDigests(digests map[string]string) string {
	encoded, err := json.Marshal(digests)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func parseDigests(encoded string) map[string]string {
	if encoded == "" {
		return nil
	}
	var digests map[string]string
	if err := json.Unmarshal([]byte(encoded), &digests); err != nil {
		return nil
	}
	return digests
}

// removeSecureCreate drops secure.<key>.create, keeping any explicit reference beside it.
func removeSecureCreate(obj *unstructured.Unstructured, key string) {
	secure, found, _ := unstructured.NestedMap(obj.Object, "secure")
	if !found {
		return
	}
	entry, ok := secure[key].(map[string]any)
	if !ok {
		return
	}

	delete(entry, "create")
	if len(entry) == 0 {
		delete(secure, key)
	} else {
		secure[key] = entry
	}

	if len(secure) == 0 {
		unstructured.RemoveNestedField(obj.Object, "secure")
		return
	}
	_ = unstructured.SetNestedMap(obj.Object, secure, "secure")
}
