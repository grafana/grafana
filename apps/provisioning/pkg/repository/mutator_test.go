package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func newMutatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.RepositoryResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestNewAdmissionMutator(t *testing.T) {
	factory := NewMockFactory(t)
	m := NewAdmissionMutator(factory, 5*time.Second)
	require.NotNil(t, m)
	assert.Equal(t, factory, m.factory)
}

func TestAdmissionMutator_Mutate(t *testing.T) {
	tests := []struct {
		name            string
		obj             runtime.Object
		operation       admission.Operation
		factoryErr      error
		minSyncInterval time.Duration
		wantFinalizers  []string
		wantInterval    int64
		wantWorkflows   []provisioning.Workflow
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "adds finalizers on create",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.RepositorySpec{},
			},
			operation:       admission.Create,
			minSyncInterval: 60 * time.Second,
			wantFinalizers:  []string{RemoveOrphanResourcesFinalizer, CleanFinalizer},
			wantInterval:    60,
			wantWorkflows:   []provisioning.Workflow{},
			wantErr:         false,
		},
		{
			name: "does not overwrite existing finalizers on create",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{"custom-finalizer"},
				},
				Spec: provisioning.RepositorySpec{},
			},
			operation:       admission.Create,
			minSyncInterval: 60 * time.Second,
			wantFinalizers:  []string{"custom-finalizer"},
			wantInterval:    60,
			wantWorkflows:   []provisioning.Workflow{},
			wantErr:         false,
		},
		{
			name: "does not add finalizers on update",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.RepositorySpec{},
			},
			operation:       admission.Update,
			minSyncInterval: 60 * time.Second,
			wantFinalizers:  nil,
			wantInterval:    60,
			wantWorkflows:   []provisioning.Workflow{},
			wantErr:         false,
		},
		{
			name: "sets default sync interval when given one is 0",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{IntervalSeconds: 0},
				},
			},
			minSyncInterval: 60 * time.Second,
			operation:       admission.Update,
			wantInterval:    60,
			wantErr:         false,
		},
		{
			name: "sets default sync interval when given one is lower than min sync interval",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{IntervalSeconds: 20},
				},
			},
			minSyncInterval: 60 * time.Second,
			operation:       admission.Update,
			wantInterval:    60,
			wantErr:         false,
		},
		{
			name: "preserves existing sync interval when greater than min sync interval",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{IntervalSeconds: 120},
				},
			},
			minSyncInterval: 60 * time.Second,
			operation:       admission.Update,
			wantInterval:    120,
			wantErr:         false,
		},
		{
			name: "initializes nil workflows",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Workflows: nil,
				},
			},
			operation:     admission.Update,
			wantWorkflows: []provisioning.Workflow{},
			wantErr:       false,
		},
		{
			name: "preserves existing workflows",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			operation:     admission.Update,
			wantWorkflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			wantErr:       false,
		},
		{
			name:            "returns error for non-repository object",
			obj:             &provisioning.Connection{},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "expected repository configuration",
		},
		{
			name:      "returns nil for nil object",
			obj:       nil,
			operation: admission.Create,
			wantErr:   false,
		},
		{
			name: "propagates factory mutate error",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec:       provisioning.RepositorySpec{},
			},
			operation:       admission.Update,
			factoryErr:      errors.New("factory error"),
			wantErr:         true,
			wantErrContains: "failed to mutate repository",
		},
		{
			name: "does not add finalizers when resource is marked for deletion",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.RepositorySpec{},
			},
			operation:       admission.Update,
			minSyncInterval: 60 * time.Second,
			wantFinalizers:  nil,
			wantInterval:    60,
			wantWorkflows:   []provisioning.Workflow{},
			wantErr:         false,
		},
		{
			name: "does not add finalizers when DeletionTimestamp is zero",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test",
					DeletionTimestamp: &metav1.Time{},
				},
				Spec: provisioning.RepositorySpec{},
			},
			operation:       admission.Create,
			minSyncInterval: 60 * time.Second,
			wantFinalizers:  nil,
			wantInterval:    60,
			wantWorkflows:   []provisioning.Workflow{},
			wantErr:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)

			// Only set up mock if we expect it to be called
			if tt.obj != nil {
				if _, ok := tt.obj.(*provisioning.Repository); ok {
					factory.EXPECT().Mutate(mock.Anything, mock.Anything).Return(tt.factoryErr).Maybe()
				}
			}

			m := NewAdmissionMutator(factory, tt.minSyncInterval)
			attr := newMutatorTestAttributes(tt.obj, nil, tt.operation)

			err := m.Mutate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)

			if tt.obj == nil {
				return
			}

			repo, ok := tt.obj.(*provisioning.Repository)
			if !ok {
				return
			}

			if tt.wantFinalizers != nil {
				assert.Equal(t, tt.wantFinalizers, repo.Finalizers)
			}
			if tt.wantInterval > 0 {
				assert.Equal(t, tt.wantInterval, repo.Spec.Sync.IntervalSeconds)
			}
			if tt.wantWorkflows != nil {
				assert.Equal(t, tt.wantWorkflows, repo.Spec.Workflows)
			}
		})
	}
}

func TestCopySecureValues(t *testing.T) {
	tests := []struct {
		name       string
		new        *provisioning.Repository
		old        *provisioning.Repository
		wantToken  common.InlineSecureValue
		wantSecret common.InlineSecureValue
	}{
		{
			name: "copies token from old to new when new is zero",
			new:  &provisioning.Repository{},
			old: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{Name: "old-token"},
				},
			},
			wantToken: common.InlineSecureValue{Name: "old-token"},
		},
		{
			name: "copies webhook secret from old to new when new is zero",
			new:  &provisioning.Repository{},
			old: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{Name: "old-secret"},
				},
			},
			wantSecret: common.InlineSecureValue{Name: "old-secret"},
		},
		{
			name: "does not overwrite existing token in new",
			new: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{Name: "new-token"},
				},
			},
			old: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{Name: "old-token"},
				},
			},
			wantToken: common.InlineSecureValue{Name: "new-token"},
		},
		{
			name:      "handles nil old repository",
			new:       &provisioning.Repository{},
			old:       nil,
			wantToken: common.InlineSecureValue{},
		},
		{
			name:      "handles old repository with zero secure values",
			new:       &provisioning.Repository{},
			old:       &provisioning.Repository{},
			wantToken: common.InlineSecureValue{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			CopySecureValues(tt.new, tt.old)
			assert.Equal(t, tt.wantToken, tt.new.Secure.Token)
			assert.Equal(t, tt.wantSecret, tt.new.Secure.WebhookSecret)
		})
	}
}
