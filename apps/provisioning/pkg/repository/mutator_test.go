package repository

import (
	"context"
	"errors"
	"strings"
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
	return newMutatorTestAttributesWithSubresource(obj, old, op, "")
}

func newMutatorTestAttributesWithSubresource(obj, old runtime.Object, op admission.Operation, subresource string) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.RepositoryResourceInfo.GroupVersionResource(),
		subresource,
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
		wantWebhookURL  *string
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
			wantFinalizers:  []string{RemoveOrphanResourcesFinalizer, RemovePendingJobsFinalizer, CleanFinalizer},
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
		{
			name: "trims trailing slash from webhook base URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Webhook: &provisioning.WebhookConfig{BaseURL: "https://grafana.example.com/"},
				},
			},
			operation:      admission.Create,
			wantWebhookURL: new("https://grafana.example.com"),
			wantWorkflows:  []provisioning.Workflow{},
			wantErr:        false,
		},
		{
			name: "trims multiple trailing slashes from webhook base URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Webhook: &provisioning.WebhookConfig{BaseURL: "https://grafana.example.com///"},
				},
			},
			operation:      admission.Create,
			wantWebhookURL: new("https://grafana.example.com"),
			wantWorkflows:  []provisioning.Workflow{},
			wantErr:        false,
		},
		{
			name: "preserves webhook base URL without trailing slash",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec: provisioning.RepositorySpec{
					Webhook: &provisioning.WebhookConfig{BaseURL: "https://grafana.example.com"},
				},
			},
			operation:      admission.Create,
			wantWebhookURL: new("https://grafana.example.com"),
			wantWorkflows:  []provisioning.Workflow{},
			wantErr:        false,
		},
		{
			name: "leaves nil webhook untouched",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
				Spec:       provisioning.RepositorySpec{},
			},
			operation:     admission.Create,
			wantWorkflows: []provisioning.Workflow{},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := NewMockFactory(t)

			// Only set up mock if we expect it to be called
			if tt.obj != nil {
				if _, ok := tt.obj.(*provisioning.Repository); ok {
					factory.EXPECT().Mutate(mock.Anything, mock.Anything, mock.Anything).Return(tt.factoryErr).Maybe()
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
			if tt.wantWebhookURL != nil {
				require.NotNil(t, repo.Spec.Webhook)
				assert.Equal(t, *tt.wantWebhookURL, repo.Spec.Webhook.BaseURL)
			}
		})
	}
}

func TestAdmissionMutator_Mutate_ForwardsOldObjectToFactory(t *testing.T) {
	factory := NewMockFactory(t)

	oldRepo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec: provisioning.RepositorySpec{
			Sync: provisioning.SyncOptions{IntervalSeconds: 30},
		},
	}
	newRepo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{"existing"}},
		Spec:       provisioning.RepositorySpec{},
	}

	factory.EXPECT().Mutate(mock.Anything, mock.Anything, oldRepo).Return(nil).Once()

	m := NewAdmissionMutator(factory, 60*time.Second)
	attr := newMutatorTestAttributes(newRepo, oldRepo, admission.Update)

	require.NoError(t, m.Mutate(context.Background(), attr, nil))
}

func TestAdmissionMutator_Mutate_SkipsSubresourcePatches(t *testing.T) {
	factory := NewMockFactory(t)
	// No EXPECT() set up for Mutate: the mock will fail the test if it's called,
	// confirming extras (e.g. the GitLab RepoID lookup) never run for status patches.

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{IntervalSeconds: 0}},
	}
	old := repo.DeepCopy()

	m := NewAdmissionMutator(factory, 60*time.Second)
	attr := newMutatorTestAttributesWithSubresource(repo, old, admission.Update, "status")

	require.NoError(t, m.Mutate(context.Background(), attr, nil))

	// Defaulting logic (finalizers, sync interval, workflows) must not run either -
	// spec fields shouldn't be touched by a status-only patch.
	assert.Empty(t, repo.Finalizers)
	assert.Equal(t, int64(0), repo.Spec.Sync.IntervalSeconds)
	assert.Nil(t, repo.Spec.Workflows)
}

func TestAdmissionMutator_Mutate_RunsForBundledSpecChange(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{IntervalSeconds: 0}},
	}
	repo := old.DeepCopy()
	repo.Spec.Sync.IntervalSeconds = 5 // below minSyncInterval, so defaulting must clamp it

	factory := NewMockFactory(t)
	factory.EXPECT().Mutate(mock.Anything, mock.Anything, old).Return(nil).Once()

	m := NewAdmissionMutator(factory, 60*time.Second)
	attr := newMutatorTestAttributesWithSubresource(repo, old, admission.Update, "status")

	require.NoError(t, m.Mutate(context.Background(), attr, nil))

	// A bundled spec change on a /status request still goes through the normal
	// spec mutation/defaulting path, not just the raw incoming value.
	assert.Equal(t, int64(60), repo.Spec.Sync.IntervalSeconds)
}

func TestCopySecureValues(t *testing.T) {
	tests := []struct {
		name           string
		new            *provisioning.Repository
		old            *provisioning.Repository
		wantToken      common.InlineSecureValue
		wantSecret     common.InlineSecureValue
		wantSigningKey common.InlineSecureValue
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
			name: "copies commit signing key from old to new when new is zero",
			new:  &provisioning.Repository{},
			old: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					CommitSigningKey: common.InlineSecureValue{Name: "old-signing-key"},
				},
			},
			wantSigningKey: common.InlineSecureValue{Name: "old-signing-key"},
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
			assert.Equal(t, tt.wantSigningKey, tt.new.Secure.CommitSigningKey)
		})
	}
}

func TestInvalidateConnectionTokenOnURLChange(t *testing.T) {
	connectionRepo := func(url string, token common.InlineSecureValue) *provisioning.Repository {
		return &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type:       provisioning.GitHubRepositoryType,
				GitHub:     &provisioning.GitHubRepositoryConfig{URL: url},
				Connection: &provisioning.ConnectionInfo{Name: "gh-app"},
			},
			Secure: provisioning.SecureValues{Token: token},
		}
	}
	describe := func(s string) *string { return &s }

	tests := []struct {
		name      string
		new       *provisioning.Repository
		old       *provisioning.Repository
		wantToken common.InlineSecureValue
	}{
		{
			name:      "marks a stored token for removal when the url changes",
			new:       connectionRepo("https://github.com/grafana/new", common.InlineSecureValue{}),
			old:       connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{Name: "old-token"}),
			wantToken: common.InlineSecureValue{Remove: true},
		},
		{
			name:      "keeps the token when the url is unchanged",
			new:       connectionRepo("https://github.com/grafana/repo", common.InlineSecureValue{}),
			old:       connectionRepo("https://github.com/grafana/repo", common.InlineSecureValue{Name: "old-token"}),
			wantToken: common.InlineSecureValue{},
		},
		{
			name:      "keeps the token when the host changes",
			new:       connectionRepo("https://ghe.example.com/grafana/old", common.InlineSecureValue{}),
			old:       connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{Name: "old-token"}),
			wantToken: common.InlineSecureValue{},
		},
		{
			name:      "marks an echoed stored reference for removal",
			new:       connectionRepo("https://github.com/grafana/new", common.InlineSecureValue{Name: "old-token"}),
			old:       connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{Name: "old-token"}),
			wantToken: common.InlineSecureValue{Remove: true},
		},
		{
			name:      "marks an echoed reference carrying a description for removal",
			new:       connectionRepo("https://github.com/grafana/new", common.InlineSecureValue{Name: "old-token", Description: describe("git token")}),
			old:       connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{Name: "old-token"}),
			wantToken: common.InlineSecureValue{Remove: true},
		},
		{
			name:      "keeps a caller-supplied token",
			new:       connectionRepo("https://github.com/grafana/new", common.InlineSecureValue{Create: "caller-token"}),
			old:       connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{Name: "old-token"}),
			wantToken: common.InlineSecureValue{Create: "caller-token"},
		},
		{
			name:      "does nothing when no token is stored",
			new:       connectionRepo("https://github.com/grafana/new", common.InlineSecureValue{}),
			old:       connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{}),
			wantToken: common.InlineSecureValue{},
		},
		{
			name: "leaves a token-authenticated repository alone",
			new: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{URL: "https://github.com/grafana/new"},
				},
			},
			old: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{URL: "https://github.com/grafana/old"},
				},
				Secure: provisioning.SecureValues{Token: common.InlineSecureValue{Name: "old-token"}},
			},
			wantToken: common.InlineSecureValue{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			InvalidateConnectionTokenOnURLChange(tt.new, tt.old)
			assert.Equal(t, tt.wantToken, tt.new.Secure.Token)
		})
	}
}

// The mutator marks the token for removal, which makes it non-zero. A host change must
// still be rejected afterwards rather than slipping through as "a token was supplied".
func TestInvalidateConnectionTokenDoesNotBypassHostCheck(t *testing.T) {
	connectionRepo := func(url string, token common.InlineSecureValue) *provisioning.Repository {
		return &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type:       provisioning.GitHubRepositoryType,
				GitHub:     &provisioning.GitHubRepositoryConfig{URL: url},
				Connection: &provisioning.ConnectionInfo{Name: "gh-app"},
			},
			Secure: provisioning.SecureValues{Token: token},
		}
	}
	old := connectionRepo("https://github.com/grafana/old", common.InlineSecureValue{Name: "old-token"})

	sameHost := connectionRepo("https://github.com/grafana/new", common.InlineSecureValue{})
	InvalidateConnectionTokenOnURLChange(sameHost, old)
	assert.False(t, RequiresNewTokenForURLChange(sameHost, old), "same-host move should be allowed")

	hostChange := connectionRepo("https://ghe.example.com/grafana/old", common.InlineSecureValue{})
	InvalidateConnectionTokenOnURLChange(hostChange, old)
	assert.True(t, RequiresNewTokenForURLChange(hostChange, old), "host change must still require a token")
}

// The provider mutator normalizes the URL (trailing "/" and ".git"), so invalidation has to
// run after it. Otherwise an update that only adds ".git" reads as a move and discards a
// usable token, leaving the repository without credentials until the controller re-mints.
func TestAdmissionMutator_Mutate_InvalidatesAfterURLNormalization(t *testing.T) {
	newRepoAt := func(url string) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test", Finalizers: []string{CleanFinalizer}},
			Spec: provisioning.RepositorySpec{
				Type:       provisioning.GitHubRepositoryType,
				GitHub:     &provisioning.GitHubRepositoryConfig{URL: url},
				Connection: &provisioning.ConnectionInfo{Name: "gh-app"},
				Sync:       provisioning.SyncOptions{IntervalSeconds: 60},
			},
		}
	}

	tests := []struct {
		name      string
		newURL    string
		wantToken common.InlineSecureValue
	}{
		{
			name:      "same repository with a .git suffix leaves the token alone",
			newURL:    "https://github.com/grafana/repo.git",
			wantToken: common.InlineSecureValue{},
		},
		{
			name:      "same repository with a trailing slash leaves the token alone",
			newURL:    "https://github.com/grafana/repo/",
			wantToken: common.InlineSecureValue{},
		},
		{
			name:      "a different repository still invalidates",
			newURL:    "https://github.com/grafana/other.git",
			wantToken: common.InlineSecureValue{Remove: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			oldRepo := newRepoAt("https://github.com/grafana/repo")
			oldRepo.Secure.Token = common.InlineSecureValue{Name: "old-token"}
			newRepo := newRepoAt(tt.newURL)

			factory := NewMockFactory(t)
			factory.EXPECT().Mutate(mock.Anything, mock.Anything, mock.Anything).
				RunAndReturn(func(_ context.Context, obj runtime.Object, _ runtime.Object) error {
					r := obj.(*provisioning.Repository)
					r.Spec.GitHub.URL = strings.TrimSuffix(strings.TrimRight(r.Spec.GitHub.URL, "/"), ".git")
					return nil
				}).Once()

			m := NewAdmissionMutator(factory, 60*time.Second)
			attr := newMutatorTestAttributes(newRepo, oldRepo, admission.Update)

			require.NoError(t, m.Mutate(context.Background(), attr, nil))
			// A zero token means the mutator left it alone, so storage keeps the stored one.
			assert.Equal(t, tt.wantToken, newRepo.Secure.Token)
		})
	}
}

// Description is a *string, so comparing whole structs compares pointers: an echoed
// reference that carries a description would never match the stored one and would count as
// a supplied token, skipping both the re-mint and the host check.
func TestSuppliedNewTokenIgnoresDescription(t *testing.T) {
	repoWithToken := func(token common.InlineSecureValue) *provisioning.Repository {
		return &provisioning.Repository{Secure: provisioning.SecureValues{Token: token}}
	}
	describe := func(s string) *string { return &s }

	tests := []struct {
		name string
		new  common.InlineSecureValue
		old  common.InlineSecureValue
		want bool
	}{
		{
			name: "echoed reference with a description is not a new token",
			new:  common.InlineSecureValue{Name: "inline-abc", Description: describe("git token")},
			old:  common.InlineSecureValue{Name: "inline-abc"},
			want: false,
		},
		{
			name: "same description in a different allocation is not a new token",
			new:  common.InlineSecureValue{Name: "inline-abc", Description: describe("git token")},
			old:  common.InlineSecureValue{Name: "inline-abc", Description: describe("git token")},
			want: false,
		},
		{
			name: "a different reference is a new token",
			new:  common.InlineSecureValue{Name: "inline-xyz"},
			old:  common.InlineSecureValue{Name: "inline-abc"},
			want: true,
		},
		{
			name: "a created value is a new token",
			new:  common.InlineSecureValue{Create: "raw-token"},
			old:  common.InlineSecureValue{Name: "inline-abc"},
			want: true,
		},
		{
			name: "a removal marker is a token decision",
			new:  common.InlineSecureValue{Remove: true},
			old:  common.InlineSecureValue{Name: "inline-abc"},
			want: true,
		},
		{
			name: "an absent token is not a new token",
			old:  common.InlineSecureValue{Name: "inline-abc"},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, suppliedNewToken(repoWithToken(tt.new), repoWithToken(tt.old)))
		})
	}
}
