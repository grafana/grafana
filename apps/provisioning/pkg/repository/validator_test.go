package repository

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/grafana-app-sdk/resource"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
)

func TestValidator_Validate(t *testing.T) {
	tests := []struct {
		name          string
		repository    *provisioning.Repository
		expectedErrs  int
		validateError func(t *testing.T, errors field.ErrorList)
	}{
		{
			name: "valid repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "missing title",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.title: Required value")
			},
		},
		{
			name: "sync enabled without target",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.RepositorySyncOptions{
							Enabled:         true,
							IntervalSeconds: new(int64(10)),
						}},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.sync.target: Required value")
			},
		},
		{
			name: "reserved name",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:       "sql",
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.RepositorySyncOptions{
							Enabled:         true,
							Target:          provisioning.RepositorySyncOptionsTargetFolder,
							IntervalSeconds: new(int64(10)),
						}},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "metadata.name: Invalid value")
			},
		},
		{
			name: "mismatched local config",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Type:  provisioning.RepositorySpecTypeGithub,
						Local: &provisioning.RepositoryLocalRepositoryConfig{},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.local: Invalid value")
			},
		},
		{
			name: "mismatched github config",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.RepositorySpecTypeLocal,
						Github: &provisioning.RepositoryGitHubRepositoryConfig{},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.github: Invalid value")
			},
		},
		{
			name: "github enabled when image rendering is not allowed",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.RepositorySpecTypeGithub,
						Github: &provisioning.RepositoryGitHubRepositoryConfig{GenerateDashboardPreviews: new(true)},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.generateDashboardPreviews: Invalid value")
			},
		},
		{
			name: "githubEnterprise previews enabled via pull request options when image rendering is not allowed",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:            "Test Repo",
						Type:             provisioning.RepositorySpecTypeGithubEnterprise,
						GithubEnterprise: &provisioning.RepositoryGitHubEnterpriseRepositoryConfig{},
						PullRequest:      &provisioning.RepositoryPullRequestOptions{GenerateDashboardPreviews: new(true)},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.generateDashboardPreviews: Invalid value")
			},
		},
		{
			name: "mismatched git config",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Type:  provisioning.RepositorySpecTypeLocal,
						Git:   &provisioning.RepositoryGitRepositoryConfig{},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.git: Invalid value")
			},
		},
		{
			name: "multiple validation errors",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:       "sql",
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
						Sync: provisioning.RepositorySyncOptions{
							Enabled:         true,
							IntervalSeconds: new(int64(5)),
							Target:          "",
						},
					},
				}
			}(),
			expectedErrs: 2,
			// 1. reserved name
			// 2. Empty target
			// Note: "sync target not supported" is now checked in AdmissionValidator, not RepositoryValidator
		},
		{
			name: "branch workflow for non-github repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.RepositorySpecTypeLocal,
						Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsBranch},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.workflow: Invalid value: \"branch\": branch is only supported on git repositories")
			},
		},
		{
			name: "branch options for local repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.RepositorySpecTypeLocal,
						Branch: &provisioning.RepositoryBranchOptions{NameTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Equal(t, "spec.branch", errors[0].Field)
				require.Contains(t, errors.ToAggregate().Error(), "branch options are not supported on local repositories")
			},
		},
		{
			name: "commit options for local repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.RepositorySpecTypeLocal,
						Commit: &provisioning.RepositoryCommitOptions{SingleResourceMessageTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Equal(t, "spec.commit", errors[0].Field)
				require.Contains(t, errors.ToAggregate().Error(), "commit options are not supported on local repositories")
			},
		},
		{
			name: "pull request options for local repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:       "Test Repo",
						Type:        provisioning.RepositorySpecTypeLocal,
						PullRequest: &provisioning.RepositoryPullRequestOptions{TitleTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Equal(t, "spec.pullRequest", errors[0].Field)
				require.Contains(t, errors.ToAggregate().Error(), "pull request options are not supported on local repositories")
			},
		},
		{
			name: "branch, commit and pull request options for local repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:       "Test Repo",
						Type:        provisioning.RepositorySpecTypeLocal,
						Branch:      &provisioning.RepositoryBranchOptions{NameTemplate: new("{{title}}")},
						Commit:      &provisioning.RepositoryCommitOptions{SingleResourceMessageTemplate: new("{{title}}")},
						PullRequest: &provisioning.RepositoryPullRequestOptions{TitleTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 3,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "branch options are not supported on local repositories")
				require.Contains(t, errors.ToAggregate().Error(), "commit options are not supported on local repositories")
				require.Contains(t, errors.ToAggregate().Error(), "pull request options are not supported on local repositories")
			},
		},
		{
			name: "branch, commit and pull request options allowed for github repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:       "Test Repo",
						Type:        provisioning.RepositorySpecTypeGithub,
						Branch:      &provisioning.RepositoryBranchOptions{NameTemplate: new("{{title}}")},
						Commit:      &provisioning.RepositoryCommitOptions{SingleResourceMessageTemplate: new("{{title}}")},
						PullRequest: &provisioning.RepositoryPullRequestOptions{TitleTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "pull request options for git repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:       "Test Repo",
						Type:        provisioning.RepositorySpecTypeGit,
						PullRequest: &provisioning.RepositoryPullRequestOptions{TitleTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Equal(t, "spec.pullRequest", errors[0].Field)
				require.Contains(t, errors.ToAggregate().Error(), "pull request options are not supported on git repositories")
			},
		},
		{
			name: "branch and commit options allowed for git repository",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:  "Test Repo",
						Type:   provisioning.RepositorySpecTypeGit,
						Branch: &provisioning.RepositoryBranchOptions{NameTemplate: new("{{title}}")},
						Commit: &provisioning.RepositoryCommitOptions{SingleResourceMessageTemplate: new("{{title}}")},
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "invalid workflow in the list",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.RepositorySpecTypeGithub,
						Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsWrite, "invalid"},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "spec.workflow: Invalid value: \"invalid\": invalid workflow")
			},
		},
		{
			name: "mutual exclusive finalizers are set together",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{RemoveOrphanResourcesFinalizer, ReleaseOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.RepositorySpecTypeGithub,
						Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsWrite},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "cannot have both remove and release orphan resources finalizers")
			},
		},
		{
			name: "invalid finalizer in the list",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, "invalid-finalizer", RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.RepositorySpecTypeGithub,
						Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsWrite},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "unknown finalizer: invalid-finalizer")
			},
		},
		{
			name: "valid webhook base URL",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:   "Test Repo",
						Webhook: &provisioning.RepositoryWebhookConfig{BaseUrl: new("https://grafana.example.com/")},
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "valid HTTP webhook base URL",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:   "Test Repo",
						Webhook: &provisioning.RepositoryWebhookConfig{BaseUrl: new("http://grafana.example.com")},
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "webhook base URL with unsupported scheme",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:   "Test Repo",
						Webhook: &provisioning.RepositoryWebhookConfig{BaseUrl: new("ftp://grafana.example.com/")},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "must use HTTP or HTTPS scheme")
			},
		},
		{
			name: "webhook base URL missing host",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title:   "Test Repo",
						Webhook: &provisioning.RepositoryWebhookConfig{BaseUrl: new("https://")},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "must include a host")
			},
		},
		{
			name: "nil webhook section is allowed",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				}
			}(),
			expectedErrs: 0,
		},
		{
			name: "no finalizers on resource not marked for deletion",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Finalizers: []string{},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.RepositorySpecTypeGithub,
						Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsWrite},
					},
				}
			}(),
			expectedErrs: 1,
			validateError: func(t *testing.T, errors field.ErrorList) {
				require.Contains(t, errors.ToAggregate().Error(), "cannot have no finalizers set on resources not marked for deletion")
			},
		},
		{
			// A resource marked for deletion legitimately has its finalizers
			// removed, so the missing-finalizer check must be skipped for it.
			name: "no finalizers allowed on resource marked for deletion",
			repository: func() *provisioning.Repository {
				return &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						DeletionTimestamp: &metav1.Time{Time: time.Now()},
						Finalizers:        []string{},
					},
					Spec: provisioning.RepositorySpec{
						Title:     "Test Repo",
						Type:      provisioning.RepositorySpecTypeGithub,
						Workflows: []provisioning.RepositorySpecWorkflows{provisioning.RepositorySpecWorkflowsWrite},
					},
				}
			}(),
			expectedErrs: 0,
		},
	}

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()
	validator := NewValidator(false, mockFactory)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Tests validate new configurations, so always pass isCreate=true
			errors := validator.Validate(context.Background(), tt.repository)
			require.Len(t, errors, tt.expectedErrs)
			if tt.validateError != nil {
				tt.validateError(t, errors)
			}
		})
	}
}

func TestValidator_ValidatePrivateEndpoint(t *testing.T) {
	tests := []struct {
		name             string
		repository       *provisioning.Repository
		allowlistEntries []string
		wantErrContains  string
	}{
		{
			name: "blocks generic git loopback IP without allowlist",
			repository: testPrivateEndpointGitRepository(
				provisioning.RepositorySpecTypeGit,
				"https://127.0.0.1/grafana/grafana.git",
			),
			wantErrContains: "repository URL host must resolve to a public or allowed address",
		},
		{
			name: "blocks github DNS resolving to private IP without allowlist",
			repository: testPrivateEndpointGitRepository(
				provisioning.RepositorySpecTypeGithub,
				"https://github.internal.example.com/grafana/grafana",
			),
			wantErrContains: "repository URL host must resolve to a public or allowed address",
		},
		{
			name: "allows generic git loopback IP when allowlisted",
			repository: testPrivateEndpointGitRepository(
				provisioning.RepositorySpecTypeGit,
				"https://127.0.0.1/grafana/grafana.git",
			),
			allowlistEntries: []string{"127.0.0.1"},
		},
		{
			name: "allows github private DNS when hostname is allowlisted",
			repository: testPrivateEndpointGitRepository(
				provisioning.RepositorySpecTypeGithub,
				"https://github.internal.example.com/grafana/grafana",
			),
			allowlistEntries: []string{"github.internal.example.com"},
		},
		{
			name: "allows github private DNS when resolved IP is in allowlisted CIDR",
			repository: testPrivateEndpointGitRepository(
				provisioning.RepositorySpecTypeGithub,
				"https://github.internal.example.com/grafana/grafana",
			),
			allowlistEntries: []string{"10.0.0.0/24"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := NewMockFactory(t)
			mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

			allowlist, err := NewAllowlist(tt.allowlistEntries)
			require.NoError(t, err)

			urlValidator := NewURLValidator(allowlist, func(_ context.Context, host string) ([]net.IPAddr, error) {
				if host == "github.internal.example.com" {
					return []net.IPAddr{{IP: net.ParseIP("10.0.0.10")}}, nil
				}
				return []net.IPAddr{{IP: net.ParseIP("93.184.216.34")}}, nil
			})
			opts := []ValidatorOption{WithURLValidator(urlValidator)}
			validator := NewValidator(false, mockFactory, opts...)

			errors := validator.Validate(context.Background(), tt.repository)
			if tt.wantErrContains != "" {
				require.NotEmpty(t, errors)
				require.Contains(t, errors.ToAggregate().Error(), tt.wantErrContains)
				return
			}
			require.Empty(t, errors)
		})
	}
}

func testPrivateEndpointGitRepository(repoType provisioning.RepositorySpecType, rawURL string) *provisioning.Repository {
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  repoType,
		},
	}
	switch repoType {
	case provisioning.RepositorySpecTypeGit:
		repo.Spec.Git = &provisioning.RepositoryGitRepositoryConfig{
			Url:    new(rawURL),
			Branch: "main",
		}
	case provisioning.RepositorySpecTypeGithub:
		repo.Spec.Github = &provisioning.RepositoryGitHubRepositoryConfig{
			Url:    new(rawURL),
			Branch: "main",
		}
	default:
		// Do nothing
	}
	return repo
}

func newAdmissionValidatorTestAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return newAdmissionValidatorTestAttributesWithSubresource(obj, old, op, "")
}

func newAdmissionValidatorTestAttributesWithSubresource(obj, old runtime.Object, op admission.Operation, subresource string) admission.Attributes {
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

func TestAdmissionValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		obj             runtime.Object
		old             runtime.Object
		operation       admission.Operation
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "valid repository passes validation",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			operation: admission.Create,
			wantErr:   false,
		},
		{
			name: "invalid repository fails validation",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					// Missing title
					Type: provisioning.RepositorySpecTypeGithub,
				},
			},
			operation: admission.Create,
			wantErr:   true,
		},
		{
			name:    "returns nil for nil object",
			obj:     nil,
			wantErr: false,
		},
		{
			name: "returns error for non-repository object",
			obj: &provisioning.Connection{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "expected repository configuration",
		},
		{
			name: "skips validation for DELETE operations",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
				Spec:       provisioning.RepositorySpec{
					// Invalid - missing title
				},
			},
			operation: admission.Delete,
			wantErr:   false,
		},
		{
			name: "skips validation for objects being deleted",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.RepositorySpec{
					// Invalid - missing title
				},
			},
			operation: admission.Update,
			wantErr:   false,
		},
		{
			name: "forbids changing repository type on update",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGit, // Changed from github
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			operation:       admission.Update,
			wantErr:         true,
			wantErrContains: "Changing repository type is not supported",
		},
		{
			name: "forbids changing sync target after sync",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60)), Target: provisioning.RepositorySyncOptionsTargetInstance},
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60)), Target: provisioning.RepositorySyncOptionsTargetFolder},
				},
				Status: provisioning.RepositoryStatus{
					Stats: []provisioning.ResourceCount{{Resource: "Dashboard", Count: 1}},
				},
			},
			operation:       admission.Update,
			wantErr:         true,
			wantErrContains: "Changing sync target after running sync is not supported",
		},
		{
			name: "blocks UPDATE when both old and new objects have the pending-delete label",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
					Labels:     map[string]string{appcontroller.LabelPendingDelete: "true"},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo (modified)",
					Type:  provisioning.RepositorySpecTypeGithub,
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:   "test",
					Labels: map[string]string{appcontroller.LabelPendingDelete: "true"},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
				},
			},
			operation:       admission.Update,
			wantErr:         true,
			wantErrContains: "namespace is pending deletion",
		},
		{
			name: "allows UPDATE that removes the pending-delete label (explicit unlock)",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
					Labels:     map[string]string{appcontroller.LabelPendingDelete: "true"},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			operation: admission.Update,
			wantErr:   false,
		},
		{
			name: "allows the UPDATE that sets the pending-delete label (old without label → new with label)",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
					Labels:     map[string]string{appcontroller.LabelPendingDelete: "true"},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			old: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
					Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
				},
			},
			operation: admission.Update,
			wantErr:   false,
		},
		{
			name: "blocks CREATE when incoming object carries the pending-delete label",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Finalizers: []string{CleanFinalizer},
					Labels:     map[string]string{appcontroller.LabelPendingDelete: "true"},
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repo",
					Type:  provisioning.RepositorySpecTypeGithub,
				},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "namespace is pending deletion",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := NewMockFactory(t)
			mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

			validator := NewValidator(false, mockFactory)

			admissionValidator := NewAdmissionValidator(
				[]provisioning.RepositorySyncOptionsTarget{
					provisioning.RepositorySyncOptionsTargetFolder,
					provisioning.RepositorySyncOptionsTargetInstance,
				},
				validator,
			)

			attr := newAdmissionValidatorTestAttributes(tt.obj, tt.old, tt.operation)

			err := admissionValidator.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestAdmissionValidator_Validate_SkipsSubresourcePatches(t *testing.T) {
	mockFactory := NewMockFactory(t)
	// No EXPECT() set up for Validate: the mock will fail the test if it's called,
	// confirming the factory/extras validation never runs for status patches.

	validator := NewValidator(false, mockFactory)
	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolder},
		validator,
	)

	// Missing finalizers and title would normally fail RepositoryValidator.Validate,
	// but since old carries the exact same spec/secure, this is a pure status patch.
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test"},
		Spec:       provisioning.RepositorySpec{},
	}
	old := repo.DeepCopy()

	attr := newAdmissionValidatorTestAttributesWithSubresource(repo, old, admission.Update, "status")

	require.NoError(t, admissionValidator.Validate(context.Background(), attr, nil))
}

func TestAdmissionValidator_Validate_RunsForBundledSpecChange(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{Title: "Test Repo"},
	}
	// Bundled onto a /status request: spec.title is cleared, which
	// RepositoryValidator.Validate rejects.
	repo := old.DeepCopy()
	repo.Spec.Title = ""

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Once()

	validator := NewValidator(false, mockFactory)
	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolder},
		validator,
	)

	attr := newAdmissionValidatorTestAttributesWithSubresource(repo, old, admission.Update, "status")

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "spec.title: Required value")
}

func TestAdmissionValidator_CopiesSecureValuesOnUpdate(t *testing.T) {
	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	validator := NewValidator(false, mockFactory)
	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolder},
		validator,
	)

	oldRepo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.RepositorySpecTypeGithub,
			Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
		},
		Secure: resource.InlineSecureValues{
			provisioning.RepositorySecureToken:         resource.InlineSecureValue{Name: "old-token"},
			provisioning.RepositorySecureWebhookSecret: resource.InlineSecureValue{Name: "old-secret"},
		},
	}

	newRepo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.RepositorySpecTypeGithub,
			Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
		},
		// No secure values set
	}

	attr := newAdmissionValidatorTestAttributes(newRepo, oldRepo, admission.Update)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.NoError(t, err)

	// Verify secure values were copied
	assert.Equal(t, "old-token", newRepo.Secure[provisioning.RepositorySecureToken].Name)
	assert.Equal(t, "old-secret", newRepo.Secure[provisioning.RepositorySecureWebhookSecret].Name)
}

func TestAdmissionValidator_RequiresNewTokenWhenURLChanges(t *testing.T) {
	tests := []struct {
		name            string
		oldURL          string
		newURL          string
		newToken        resource.InlineSecureValue
		connection      string
		wantErr         bool
		wantErrContains string
	}{
		{
			name:            "rejects url change without new token",
			oldURL:          "https://github.com/grafana/old",
			newURL:          "https://github.com/grafana/new",
			wantErr:         true,
			wantErrContains: "secure.token",
		},
		{
			name:     "allows url change with new token",
			oldURL:   "https://github.com/grafana/old",
			newURL:   "https://github.com/grafana/new",
			newToken: resource.InlineSecureValue{Create: "new-token"},
			wantErr:  false,
		},
		{
			name:    "allows unchanged url without new token",
			oldURL:  "https://github.com/grafana/repo",
			newURL:  "https://github.com/grafana/repo",
			wantErr: false,
		},
		{
			name:       "allows url change on the same host for a connection-backed repository",
			oldURL:     "https://github.com/grafana/old",
			newURL:     "https://github.com/grafana/new",
			connection: "gh-app",
			wantErr:    false,
		},
		{
			name:            "rejects url change when the stored token reference is echoed back",
			oldURL:          "https://github.com/grafana/old",
			newURL:          "https://github.com/grafana/new",
			newToken:        resource.InlineSecureValue{Name: "old-token"},
			wantErr:         true,
			wantErrContains: "secure.token",
		},
		{
			name:            "rejects host change for a connection-backed repository",
			oldURL:          "https://github.com/grafana/old",
			newURL:          "https://attacker.example.com/grafana/old",
			connection:      "gh-app",
			wantErr:         true,
			wantErrContains: "secure.token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockFactory := NewMockFactory(t)
			mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

			validator := NewValidator(false, mockFactory)
			admissionValidator := NewAdmissionValidator(
				[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolder},
				validator,
			)

			oldRepo := newGitHubRepositoryForURLChangeTest(tt.oldURL)
			oldRepo.SetSecureValue(provisioning.RepositorySecureToken, resource.InlineSecureValue{Name: "old-token"})

			newRepo := newGitHubRepositoryForURLChangeTest(tt.newURL)
			newRepo.SetSecureValue(provisioning.RepositorySecureToken, tt.newToken)
			if tt.connection != "" {
				oldRepo.Spec.Connection = &provisioning.RepositoryConnectionInfo{Name: tt.connection}
				newRepo.Spec.Connection = &provisioning.RepositoryConnectionInfo{Name: tt.connection}
			}

			attr := newAdmissionValidatorTestAttributes(newRepo, oldRepo, admission.Update)

			err := admissionValidator.Validate(context.Background(), attr, nil)
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErrContains)
				assert.Equal(t, tt.newToken, newRepo.Secure[provisioning.RepositorySecureToken], "secure values should not be copied after rejection")
				return
			}

			require.NoError(t, err)
		})
	}
}

func newGitHubRepositoryForURLChangeTest(url string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.RepositorySpecTypeGithub,
			Github: &provisioning.RepositoryGitHubRepositoryConfig{
				Url:    new(url),
				Branch: "main",
			},
			Sync: provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
		},
	}
}

// mockValidator implements Validator for testing
type mockValidator struct {
	called bool
	errors field.ErrorList
}

func (m *mockValidator) Validate(ctx context.Context, cfg *provisioning.Repository) field.ErrorList {
	m.called = true
	return m.errors
}

func TestAdmissionValidator_CallsMultipleValidators(t *testing.T) {
	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	baseValidator := NewValidator(false, mockFactory)
	additionalValidator := &mockValidator{}

	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolder},
		baseValidator,
		additionalValidator,
	)

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.RepositorySpecTypeGithub,
			Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
		},
	}

	attr := newAdmissionValidatorTestAttributes(repo, nil, admission.Create)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.NoError(t, err)
	assert.True(t, additionalValidator.called, "additional validator should have been called")
}

func TestAdmissionValidator_ValidatorError(t *testing.T) {
	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	baseValidator := NewValidator(false, mockFactory)
	additionalValidator := &mockValidator{
		errors: field.ErrorList{field.Forbidden(field.NewPath("spec"), "duplicate repository")},
	}

	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolder},
		baseValidator,
		additionalValidator,
	)

	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "test",
			Finalizers: []string{CleanFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioning.RepositorySpecTypeGithub,
			Sync:  provisioning.RepositorySyncOptions{IntervalSeconds: new(int64(60))},
		},
	}

	attr := newAdmissionValidatorTestAttributes(repo, nil, admission.Create)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "duplicate repository")
}

func TestValidateCommitOptions(t *testing.T) {
	tests := []struct {
		name         string
		commit       *provisioning.RepositoryCommitOptions
		expectedErrs []string
	}{
		{
			name:   "no commit options",
			commit: nil,
		},
		{
			name:   "author override without signing",
			commit: &provisioning.RepositoryCommitOptions{AuthorName: new("Sync Bot"), AuthorEmail: new("bot@example.com")},
		},
		{
			name:   "signing without author override",
			commit: &provisioning.RepositoryCommitOptions{SigningMethod: new(provisioning.RepositoryCommitOptionsSigningMethodSsh), SignerName: new("Bot Signer")},
		},
		{
			name: "signer without a signing method",
			commit: &provisioning.RepositoryCommitOptions{
				SignerName:     new("Bot Signer"),
				SignerEmail:    new("signer@example.com"),
				SignerIsAuthor: new(true),
			},
			expectedErrs: []string{"spec.commit.signerName", "spec.commit.signerEmail", "spec.commit.signerIsAuthor"},
		},
		{
			name:         "signer as author without a signing method",
			commit:       &provisioning.RepositoryCommitOptions{SignerIsAuthor: new(true)},
			expectedErrs: []string{"spec.commit.signerIsAuthor"},
		},
		{
			name: "author override with signing",
			commit: &provisioning.RepositoryCommitOptions{
				AuthorName:    new("Sync Bot"),
				AuthorEmail:   new("bot@example.com"),
				SigningMethod: new(provisioning.RepositoryCommitOptionsSigningMethodSsh),
			},
			expectedErrs: []string{"spec.commit.authorName", "spec.commit.authorEmail"},
		},
		{
			name: "author email override with signing",
			commit: &provisioning.RepositoryCommitOptions{
				AuthorEmail:   new("bot@example.com"),
				SigningMethod: new(provisioning.RepositoryCommitOptionsSigningMethodSsh),
			},
			expectedErrs: []string{"spec.commit.authorEmail"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := validateCommitOptions(&provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Title:  "Test Repo",
					Type:   provisioning.RepositorySpecTypeGithub,
					Commit: tt.commit,
				},
			})

			require.Len(t, errs, len(tt.expectedErrs))
			for i, expected := range tt.expectedErrs {
				assert.Equal(t, expected, errs[i].Field)
			}
		})
	}
}

// A repository whose path has stopped being permitted must still be able to turn its sync off.
func TestAdmissionValidator_Validate_AllowsDisablingSyncWithoutRevalidatingTheSpec(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "bootstrap",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Bootstrap",
			Type:  provisioning.RepositorySpecTypeLocal,
			Local: &provisioning.RepositoryLocalRepositoryConfig{Path: new("/no/longer/permitted")},
			Sync:  provisioning.RepositorySyncOptions{Enabled: true, Target: provisioning.RepositorySyncOptionsTargetFolderless},
		},
	}
	repo := old.DeepCopy()
	repo.Spec.Sync.Enabled = false

	// No EXPECT() for Validate: the type validators, which are what would reject the path,
	// must not run for a change that introduces no spec content.
	mockFactory := NewMockFactory(t)
	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolderless},
		NewValidator(false, mockFactory),
	)

	attr := newAdmissionValidatorTestAttributes(repo, old, admission.Update)

	require.NoError(t, admissionValidator.Validate(context.Background(), attr, nil))
}

func TestAdmissionValidator_Validate_StillValidatesChangesBundledWithDisablingSync(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "bootstrap",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Bootstrap",
			Type:  provisioning.RepositorySpecTypeLocal,
			Local: &provisioning.RepositoryLocalRepositoryConfig{Path: new("conf/provisioning/bootstrap")},
			Sync:  provisioning.RepositorySyncOptions{Enabled: true, Target: provisioning.RepositorySyncOptionsTargetFolderless},
		},
	}
	// Repointing the path while switching the sync off must not ride the exemption.
	repo := old.DeepCopy()
	repo.Spec.Sync.Enabled = false
	repo.Spec.Local = &provisioning.RepositoryLocalRepositoryConfig{Path: new("/somewhere/else")}

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).
		Return(field.ErrorList{field.Invalid(field.NewPath("spec", "local", "path"), "/somewhere/else", "not permitted")}).Once()

	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolderless},
		NewValidator(false, mockFactory),
	)

	attr := newAdmissionValidatorTestAttributes(repo, old, admission.Update)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not permitted")
}

func TestAdmissionValidator_Validate_StillValidatesWhenEnablingSync(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "bootstrap",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Bootstrap",
			Type:  provisioning.RepositorySpecTypeLocal,
			Local: &provisioning.RepositoryLocalRepositoryConfig{Path: new("/no/longer/permitted")},
			Sync:  provisioning.RepositorySyncOptions{Enabled: false, Target: provisioning.RepositorySyncOptionsTargetFolderless},
		},
	}
	repo := old.DeepCopy()
	repo.Spec.Sync.Enabled = true

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).
		Return(field.ErrorList{field.Invalid(field.NewPath("spec", "local", "path"), "/no/longer/permitted", "not permitted")}).Once()

	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolderless},
		NewValidator(false, mockFactory),
	)

	attr := newAdmissionValidatorTestAttributes(repo, old, admission.Update)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not permitted")
}

// Finalizers count as a change: remove-orphan and release-orphan are mutually exclusive.
func TestAdmissionValidator_Validate_StillValidatesFinalizersBundledWithDisablingSync(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "bootstrap",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Bootstrap",
			Type:  provisioning.RepositorySpecTypeLocal,
			Local: &provisioning.RepositoryLocalRepositoryConfig{Path: new("conf/provisioning/bootstrap")},
			Sync:  provisioning.RepositorySyncOptions{Enabled: true, Target: provisioning.RepositorySyncOptionsTargetFolderless},
		},
	}
	repo := old.DeepCopy()
	repo.Spec.Sync.Enabled = false
	repo.Finalizers = append(repo.Finalizers, ReleaseOrphanResourcesFinalizer)

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).Return(field.ErrorList{}).Maybe()

	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolderless},
		NewValidator(false, mockFactory),
	)

	attr := newAdmissionValidatorTestAttributes(repo, old, admission.Update)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot have both remove and release orphan resources finalizers")
}

func TestAdmissionValidator_Validate_StillValidatesSecureValuesBundledWithDisablingSync(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "bootstrap",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Bootstrap",
			Type:  provisioning.RepositorySpecTypeLocal,
			Local: &provisioning.RepositoryLocalRepositoryConfig{Path: new("conf/provisioning/bootstrap")},
			Sync:  provisioning.RepositorySyncOptions{Enabled: true, Target: provisioning.RepositorySyncOptionsTargetFolderless},
		},
	}
	// A new token riding along with the disable is content the validators have to see.
	repo := old.DeepCopy()
	repo.Spec.Sync.Enabled = false
	repo.SetSecureValue(provisioning.RepositorySecureToken, resource.InlineSecureValue{Create: "new-token"})

	mockFactory := NewMockFactory(t)
	mockFactory.EXPECT().Validate(mock.Anything, mock.Anything).
		Return(field.ErrorList{field.Invalid(field.NewPath("secure", "token"), "", "rejected")}).Once()

	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolderless},
		NewValidator(false, mockFactory),
	)

	attr := newAdmissionValidatorTestAttributes(repo, old, admission.Update)

	err := admissionValidator.Validate(context.Background(), attr, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "rejected")
}

// The mutator clamps the interval before validation, so raising min_sync_interval in the same
// restart would otherwise make the disable look like a second change.
func TestAdmissionValidator_Validate_AllowsDisablingSyncAfterTheIntervalWasClamped(t *testing.T) {
	old := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       "bootstrap",
			Finalizers: []string{CleanFinalizer, RemoveOrphanResourcesFinalizer},
		},
		Spec: provisioning.RepositorySpec{
			Title: "Bootstrap",
			Type:  provisioning.RepositorySpecTypeLocal,
			Local: &provisioning.RepositoryLocalRepositoryConfig{Path: new("/no/longer/permitted")},
			Sync: provisioning.RepositorySyncOptions{
				Enabled:         true,
				Target:          provisioning.RepositorySyncOptionsTargetFolderless,
				IntervalSeconds: new(int64(10)),
			},
		},
	}
	// What the mutator leaves behind once min_sync_interval has been raised to 60s.
	repo := old.DeepCopy()
	repo.Spec.Sync.Enabled = false
	repo.Spec.Sync.IntervalSeconds = new(int64(60))

	// No EXPECT() for Validate: the type validators, which would reject the path, must not run.
	mockFactory := NewMockFactory(t)
	admissionValidator := NewAdmissionValidator(
		[]provisioning.RepositorySyncOptionsTarget{provisioning.RepositorySyncOptionsTargetFolderless},
		NewValidator(false, mockFactory),
	)

	attr := newAdmissionValidatorTestAttributes(repo, old, admission.Update)

	require.NoError(t, admissionValidator.Validate(context.Background(), attr, nil))
}
