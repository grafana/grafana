package snapshot

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	secretcontracts "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// encryptingStore applies envelope encryption to Spec.Dashboard at the
// unified-storage boundary so the plaintext is never persisted: writes move
// it into Spec.DashboardEncrypted, reads restore it.
type encryptingStore struct {
	grafanarest.Storage
	encryptionManager secretcontracts.EncryptionManager
}

var _ grafanarest.Storage = (*encryptingStore)(nil)

// NewEncryptingStore wraps the unified-storage branch of the snapshot
// dual-writer with the namespace-scoped app-platform EncryptionManager so
// each tenant's snapshots are bound to their own data keys.
func NewEncryptingStore(inner grafanarest.Storage, encryptionManager secretcontracts.EncryptionManager) grafanarest.Storage {
	return &encryptingStore{Storage: inner, encryptionManager: encryptionManager}
}

func (s *encryptingStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if err := s.encryptInPlace(ctx, obj); err != nil {
		return nil, err
	}
	out, err := s.Storage.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}
	if err := s.decryptInPlace(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Update is rejected: snapshots are immutable. Enforced here so the rejection
// holds even in dual-writer modes that bypass the legacy store.
func (s *encryptingStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("snapshots are immutable and cannot be updated")
}

func (s *encryptingStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	out, err := s.Storage.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}
	if err := s.decryptInPlace(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
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

// namespaceFromContext returns the request namespace for EncryptionManager
// scoping. An empty namespace would silently share one DEK across tenants,
// so we error instead of defaulting.
func namespaceFromContext(ctx context.Context) (xkube.Namespace, error) {
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		return "", fmt.Errorf("missing namespace in request context")
	}
	return xkube.Namespace(ns), nil
}
