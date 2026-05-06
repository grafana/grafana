package snapshot

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/secrets"
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
	inner          grafanarest.Storage
	secretsService secrets.Service
}

var _ grafanarest.Storage = (*encryptingStore)(nil)

// NewEncryptingStore wraps inner so that snapshot dashboards are encrypted
// before persistence and decrypted after reads. It is meant to wrap the
// unified-storage branch of the snapshot dual-writer; the legacy branch
// already encrypts via dashboardsnapshots.Service.
//
// Migration invariant: a job that copies snapshots from the legacy SQL
// `dashboard_encrypted` column into unified storage must write those bytes
// verbatim into Spec.DashboardEncrypted (the envelope is compatible because
// both paths use secretsService.Encrypt with secrets.WithoutScope()), or
// route plaintext through this wrapper. Writing plaintext directly to the
// unified backend silently drops the at-rest encryption property.
func NewEncryptingStore(inner grafanarest.Storage, secretsService secrets.Service) grafanarest.Storage {
	return &encryptingStore{inner: inner, secretsService: secretsService}
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

func (s *encryptingStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	wrapped := &encryptingObjectInfo{inner: objInfo, store: s}
	out, created, err := s.inner.Update(ctx, name, wrapped, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return nil, created, err
	}
	if err := s.decryptInPlace(ctx, out); err != nil {
		return nil, created, err
	}
	return out, created, nil
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

func (s *encryptingStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	out, err := s.inner.List(ctx, options)
	if err != nil {
		return nil, err
	}
	if list, ok := out.(*dashv0.SnapshotList); ok {
		for i := range list.Items {
			if err := s.decryptSpec(ctx, &list.Items[i].Spec); err != nil {
				return nil, err
			}
		}
	}
	return out, nil
}

func (s *encryptingStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return s.inner.Delete(ctx, name, deleteValidation, options)
}

func (s *encryptingStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return s.inner.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

func (s *encryptingStore) encryptInPlace(ctx context.Context, obj runtime.Object) error {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil
	}
	if len(snap.Spec.Dashboard) == 0 {
		return nil
	}
	plaintext, err := json.Marshal(snap.Spec.Dashboard)
	if err != nil {
		return fmt.Errorf("marshal snapshot dashboard for encryption: %w", err)
	}
	ciphertext, err := s.secretsService.Encrypt(ctx, plaintext, secrets.WithoutScope())
	if err != nil {
		return fmt.Errorf("encrypt snapshot dashboard: %w", err)
	}
	snap.Spec.DashboardEncrypted = ciphertext
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
	if len(spec.DashboardEncrypted) == 0 {
		return nil
	}
	plaintext, err := s.secretsService.Decrypt(ctx, spec.DashboardEncrypted)
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

// encryptingObjectInfo decrypts the old object before the inner transform sees
// it (so user-provided transforms get plaintext) and encrypts the produced new
// object before the inner storage persists it.
type encryptingObjectInfo struct {
	inner rest.UpdatedObjectInfo
	store *encryptingStore
}

func (e *encryptingObjectInfo) Preconditions() *metav1.Preconditions {
	return e.inner.Preconditions()
}

func (e *encryptingObjectInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	if oldObj != nil {
		oldObj = oldObj.DeepCopyObject()
		if err := e.store.decryptInPlace(ctx, oldObj); err != nil {
			return nil, err
		}
	}
	obj, err := e.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}
	if err := e.store.encryptInPlace(ctx, obj); err != nil {
		return nil, err
	}
	return obj, nil
}
