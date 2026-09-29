package apistore

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	authtypes "github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var errResourceIsManagedInRepository = fmt.Errorf("this resource is managed by a repository")

func checkManagerPropertiesOnDelete(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	return enforceManagerProperties(auth, obj)
}

func checkManagerPropertiesOnCreate(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	if err := enforceClassicFPAssignment(auth, obj); err != nil {
		return err
	}
	return enforceManagerProperties(auth, obj)
}

func checkManagerPropertiesOnUpdateSpec(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, old utils.GrafanaMetaAccessor) error {
	objKind := obj.GetAnnotation(utils.AnnoKeyManagerKind)
	oldKind := old.GetAnnotation(utils.AnnoKeyManagerKind)
	if objKind == "" && objKind == oldKind {
		return nil // not managed
	}

	// Check the current settings. Gate only a *new* classic-FP assignment: rewriting an
	// object that already carries it must keep working (allowUiUpdates), and removal is
	// handled further down.
	if oldManager, hadOld := old.GetManagerProperties(); !hadOld || oldManager.Kind != utils.ManagerKindClassicFP { // nolint:staticcheck
		if err := enforceClassicFPAssignment(auth, obj); err != nil {
			return err
		}
	}
	err := enforceManagerProperties(auth, obj)
	if err != nil { // new settings failed
		return err
	}

	managerNew, okNew := obj.GetManagerProperties()
	managerOld, okOld := old.GetManagerProperties()
	if managerNew == managerOld || (okNew && !okOld) { // added manager is OK
		return nil
	}

	if !okNew && okOld {
		// This allows removing the managedBy annotations if you were allowed to write them
		// originally. Not checkManagerPropertiesOnCreate: the assignment gate must not
		// block recovery of an object locked with a forged annotation.
		if err := enforceManagerProperties(auth, old); err != nil {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Reason:  metav1.StatusReasonForbidden,
				Message: "Can not remove resource manager from resource",
			}}
		}
	}
	return nil
}

// enforceClassicFPAssignment blocks assigning classic-file-provisioning provenance. The
// manager annotations are server-derived and only the file provisioner may set them.
func enforceClassicFPAssignment(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	kind := utils.ParseManagerKindString(obj.GetAnnotation(utils.AnnoKeyManagerKind))
	if kind != utils.ManagerKindClassicFP { // nolint:staticcheck
		return nil
	}
	if identity.IsServiceIdentityAuth(auth) {
		return nil // the file provisioner
	}
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusForbidden,
		Reason:  metav1.StatusReasonForbidden,
		Message: "Can not set the classic-file-provisioning resource manager",
	}}
}

func enforceManagerProperties(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	kind := obj.GetAnnotation(utils.AnnoKeyManagerKind)
	if kind == "" {
		return nil
	}

	switch utils.ParseManagerKindString(kind) {
	case utils.ManagerKindUnknown:
		return nil // not managed

	case utils.ManagerKindRepo:
		if auth.GetUID() == "access-policy:provisioning" || slices.Contains(auth.GetAudience(), provisioning.GROUP) {
			return nil // OK!
		}
		// This can fallback to writing the value with a provisioning client
		return errResourceIsManagedInRepository

	case utils.ManagerKindPlugin, utils.ManagerKindClassicFP: // nolint:staticcheck
		// ?? what identity do we use for legacy internal requests?
		return nil // no error

	case utils.ManagerKindTerraform, utils.ManagerKindKubectl:
		manager, _ := obj.GetManagerProperties()
		if manager.AllowsEdits {
			return nil // no error anyone can do it
		}
		// TODO: check the kubectl+terraform resource
		return nil

	case utils.ManagerKindGrafana:
		// Used for global role management.
		return nil // Let the api admission hooks handle it
	}
	return nil
}

func (s *Storage) handleManagedResourceRouting(ctx context.Context,
	err error,
	action resourcepb.WatchEvent_Type,
	key string,
	orig runtime.Object,
	rsp runtime.Object,
) error {
	if !errors.Is(err, errResourceIsManagedInRepository) || s.configProvider == nil {
		return err
	}
	obj, err := utils.MetaAccessor(orig)
	if err != nil {
		return err
	}
	repo, ok := obj.GetManagerProperties()
	if !ok {
		return fmt.Errorf("expected managed resource")
	}
	if repo.Kind != utils.ManagerKindRepo {
		if !repo.AllowsEdits {
			return fmt.Errorf("managed resource does not allow edits")
		}
	}
	src, ok := obj.GetSourceProperties()
	if !ok || src.Path == "" {
		return fmt.Errorf("managed resource is missing source path annotation")
	}

	cfg, err := s.configProvider.GetRestConfig(ctx)
	if err != nil {
		return err
	}
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	cfg.GroupVersion = &schema.GroupVersion{
		Group:   "provisioning.grafana.app",
		Version: "v0alpha1",
	}
	client, err := rest.RESTClientFor(cfg)
	if err != nil {
		return err
	}

	if action == resourcepb.WatchEvent_DELETED {
		// TODO? can we copy orig into rsp without a full get?
		if err = s.Get(ctx, key, storage.GetOptions{}, rsp); err != nil { // COPY?
			return err
		}
		result := client.Delete().
			Namespace(obj.GetNamespace()).
			Resource("repositories").
			Name(repo.Identity).
			Suffix("files", src.Path).
			Do(ctx)
		return result.Error()
	}

	var req *rest.Request
	switch action {
	case resourcepb.WatchEvent_ADDED:
		req = client.Post()
	case resourcepb.WatchEvent_MODIFIED:
		req = client.Put()
	default:
		return fmt.Errorf("unsupported provisioning action: %v, %w", action, err)
	}

	// Execute the change
	result := req.Namespace(obj.GetNamespace()).
		Resource("repositories").
		Name(repo.Identity).
		Suffix("files", src.Path).
		Body(orig).
		Param("skipDryRun", "true").
		Do(ctx)
	err = result.Error()
	if err != nil {
		return err
	}

	// return the updated value
	return s.Get(ctx, key, storage.GetOptions{}, rsp)
}
