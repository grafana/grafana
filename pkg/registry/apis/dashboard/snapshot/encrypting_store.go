package snapshot

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	secretcontracts "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// encryptingStore wraps a snapshot rest.Storage and applies envelope encryption
// to Spec.Dashboard at the storage boundary, matching the at-rest encryption
// the legacy SQL store provides via dashboardsnapshots.Service.
//
// On write, the plaintext Spec.Dashboard is JSON-marshaled, encrypted, and
// moved to Spec.DashboardEncrypted. Spec.Dashboard is cleared so unified
// storage never persists plaintext. On read, Spec.DashboardEncrypted is
// decrypted back into Spec.Dashboard.
type encryptingStore struct {
	inner             grafanarest.Storage
	encryptionManager secretcontracts.EncryptionManager
}

var _ grafanarest.Storage = (*encryptingStore)(nil)

// NewEncryptingStore wraps inner so that snapshot dashboards are encrypted
// before persistence and decrypted after reads. It is meant to wrap the
// unified-storage branch of the snapshot dual-writer; the legacy SQL branch
// continues to encrypt via dashboardsnapshots.Service / pkg/services/secrets,
// which is single-tenant. This wrapper uses the app-platform EncryptionManager
// (pkg/registry/apis/secret/contracts), which is namespace-scoped and works in
// both single-tenant and multi-tenant deployments.
//
// The two paths are NOT envelope-compatible: legacy ciphertext is bound to the
// global secrets service's data keys, while EncryptionManager mints
// per-namespace data keys. A future migration job that copies snapshots from
// the legacy dashboard_snapshot.dashboard_encrypted column into unified
// storage must decrypt with the legacy secrets.Service and re-encrypt
// per-namespace via EncryptionManager — copying ciphertext bytes verbatim
// will not round-trip.
func NewEncryptingStore(inner grafanarest.Storage, encryptionManager secretcontracts.EncryptionManager) grafanarest.Storage {
	return &encryptingStore{inner: inner, encryptionManager: encryptionManager}
}

func (s *encryptingStore) New() runtime.Object     { return s.inner.New() }
func (s *encryptingStore) NewList() runtime.Object { return s.inner.NewList() }
func (s *encryptingStore) Destroy()                { s.inner.Destroy() }
func (s *encryptingStore) NamespaceScoped() bool   { return s.inner.NamespaceScoped() }
func (s *encryptingStore) GetSingularName() string { return s.inner.GetSingularName() }

func (s *encryptingStore) ConvertToTable(ctx context.Context, obj runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.inner.ConvertToTable(ctx, obj, tableOptions)
}

func (s *encryptingStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if err := s.encryptInPlace(ctx, obj); err != nil {
		return nil, err
	}
	out, err := s.inner.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}
	if err := s.decryptInPlace(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Update is rejected: snapshots are immutable. Matching SnapshotLegacyStore.Update,
// which returns the same error. Failing fast here keeps the wrapper self-consistent
// regardless of dual-writer mode (in modes that skip legacy, this is the last line
// of defense).
func (s *encryptingStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("snapshots are immutable and cannot be updated")
}

func (s *encryptingStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	out, err := s.inner.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}
	if err := s.decryptInPlace(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// List does not decrypt because the snapshot list endpoint never returns the
// dashboard payload (legacy returns SnapshotDTOs without it; unified strips it
// in stripSensitiveFieldsFromList). Decrypting here would be wasted KMS work.
func (s *encryptingStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.inner.List(ctx, options)
}

func (s *encryptingStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return s.inner.Delete(ctx, name, deleteValidation, options)
}

func (s *encryptingStore) encryptInPlace(ctx context.Context, obj runtime.Object) error {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil
	}
	if len(snap.Spec.Dashboard) == 0 {
		return nil
	}
	ns, err := namespaceFromContext(ctx)
	if err != nil {
		return err
	}
	plaintext, err := json.Marshal(snap.Spec.Dashboard)
	if err != nil {
		return fmt.Errorf("marshal snapshot dashboard for encryption: %w", err)
	}
	payload, err := s.encryptionManager.Encrypt(ctx, ns, plaintext, secretcontracts.EncryptionOption{})
	if err != nil {
		return fmt.Errorf("encrypt snapshot dashboard: %w", err)
	}
	snap.Spec.DashboardEncrypted = &dashv0.SnapshotV0alpha1SpecDashboardEncrypted{
		DataKeyId:     payload.DataKeyID,
		EncryptedData: payload.EncryptedData,
	}
	snap.Spec.Dashboard = nil
	return nil
}

func (s *encryptingStore) decryptInPlace(ctx context.Context, obj runtime.Object) error {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil
	}
	return s.decryptSpec(ctx, &snap.Spec)
}

func (s *encryptingStore) decryptSpec(ctx context.Context, spec *dashv0.SnapshotSpec) error {
	if spec.DashboardEncrypted == nil || len(spec.DashboardEncrypted.EncryptedData) == 0 {
		return nil
	}
	ns, err := namespaceFromContext(ctx)
	if err != nil {
		return err
	}
	plaintext, err := s.encryptionManager.Decrypt(ctx, ns, secretcontracts.EncryptedPayload{
		DataKeyID:     spec.DashboardEncrypted.DataKeyId,
		EncryptedData: spec.DashboardEncrypted.EncryptedData,
	}, secretcontracts.EncryptionOption{})
	if err != nil {
		return fmt.Errorf("decrypt snapshot dashboard: %w", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(plaintext, &m); err != nil {
		return fmt.Errorf("unmarshal decrypted snapshot dashboard: %w", err)
	}
	spec.Dashboard = m
	spec.DashboardEncrypted = nil
	return nil
}

// namespaceFromContext extracts the request namespace as xkube.Namespace, which
// EncryptionManager uses to scope per-tenant data keys. The apiserver always
// populates the namespace on requests for namespaced resources; an empty value
// would silently collapse all tenants onto the same DEK, so we surface it as
// an error instead of defaulting.
func namespaceFromContext(ctx context.Context) (xkube.Namespace, error) {
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		return "", fmt.Errorf("missing namespace in request context")
	}
	return xkube.Namespace(ns), nil
}
