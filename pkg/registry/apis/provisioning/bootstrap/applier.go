package bootstrap

import (
	"context"
	"fmt"
	"sort"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
)

// managerIdentity marks resources owned by the provisioning file bootstrap.
const managerIdentity = "file-provisioning"

// supportedGVRs maps the only kinds the bootstrap manages to their resources. Once a Repository is
// configured, Git Sync provisions the remaining resources (dashboards, folders, …) from the
// repository itself, so other kinds are intentionally rejected. The GVRs are known statically, so
// no discovery is required.
var (
	repositoryKind = provisioning.RepositoryResourceInfo.GroupVersionKind().Kind
	connectionKind = provisioning.ConnectionResourceInfo.GroupVersionKind().Kind

	// supportedGVRs maps manifest kind -> resource for the only kinds the bootstrap manages.
	supportedGVRs = map[string]schema.GroupVersionResource{
		repositoryKind: provisioning.RepositoryResourceInfo.GroupVersionResource(),
		connectionKind: provisioning.ConnectionResourceInfo.GroupVersionResource(),
	}
)

// kindPriority orders applies so that resources referenced by others are created first.
// Connections must exist before the Repositories that reference them.
func kindPriority(kind string) int {
	if kind == connectionKind {
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
	gvr, ok := supportedGVRs[obj.GetKind()]
	if !ok {
		a.logger.Warn("skipping unsupported bootstrap manifest kind: provisioning bootstrap only manages Repository and Connection",
			"kind", obj.GetKind(), "name", obj.GetName())
		return nil
	}

	ns := obj.GetNamespace()
	name := obj.GetName()
	ri := a.dyn.Resource(gvr).Namespace(ns)

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

	if apierrors.IsNotFound(getErr) {
		// Status is owned by controllers and rejected on create; never send it.
		unstructured.RemoveNestedField(obj.Object, "status")
		if _, err := ri.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
			return fmt.Errorf("create: %w", err)
		}
		a.logger.Info("created bootstrap manifest", "kind", obj.GetKind(), "name", name, "namespace", ns)
		return nil
	}

	// Respect existing ownership: never steal a resource managed by something else.
	if mgr, ok := getManager(existing); ok && mgr.Identity != managerIdentity {
		a.logger.Warn("skipping bootstrap manifest: resource is managed by another manager",
			"kind", obj.GetKind(), "name", name, "namespace", ns, "managedBy", mgr.Kind, "managerId", mgr.Identity)
		return nil
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
	a.logger.Info("reconciled bootstrap manifest", "kind", obj.GetKind(), "name", name, "namespace", ns)
	return nil
}

func getManager(obj *unstructured.Unstructured) (utils.ManagerProperties, bool) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return utils.ManagerProperties{}, false
	}
	return meta.GetManagerProperties()
}
