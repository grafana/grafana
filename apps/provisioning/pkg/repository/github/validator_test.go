package github

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestIsValidGitHubURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		// GitHub.com URLs
		{
			name: "valid github.com URL",
			url:  "https://github.com/owner/repo",
			want: true,
		},
		{
			name: "valid github.com URL with .git",
			url:  "https://github.com/owner/repo.git",
			want: true,
		},
		{
			name: "valid github.com URL with trailing slash",
			url:  "https://github.com/owner/repo/",
			want: true,
		},
		{
			name: "valid github.com URL with .git and trailing slash",
			url:  "https://github.com/owner/repo.git/",
			want: true,
		},
		{
			name: "valid github.com URL with complex owner name",
			url:  "https://github.com/my-org/my-repo",
			want: true,
		},
		{
			name: "valid github.com URL with underscores",
			url:  "https://github.com/my_org/my_repo",
			want: true,
		},
		{
			name: "invalid - dots at start of owner name",
			url:  "https://github.com/.company/my-repo",
			want: false,
		},
		{
			name: "invalid - hyphen at start of owner name",
			url:  "https://github.com/-company/my-repo",
			want: false,
		},
		{
			name: "valid github.com URL with subgroups",
			url:  "https://github.com/org/team/repo",
			want: true,
		},

		// GitHub Enterprise URLs
		{
			name: "valid GitHub Enterprise URL",
			url:  "https://github.enterprise.com/owner/repo",
			want: true,
		},
		{
			name: "valid GitHub Enterprise URL with port",
			url:  "https://github.enterprise.com:8443/owner/repo",
			want: true,
		},
		{
			name: "valid GitHub Enterprise URL with .git",
			url:  "https://github.enterprise.com/owner/repo.git",
			want: true,
		},

		// Self-hosted instances
		{
			name: "valid self-hosted instance",
			url:  "https://git.company.local/owner/repo",
			want: true,
		},
		{
			name: "valid self-hosted with port",
			url:  "https://git.company.local:8443/owner/repo",
			want: true,
		},
		{
			name: "valid self-hosted with subdomain",
			url:  "https://code.my-company.com/owner/repo",
			want: true,
		},
		{
			name: "valid self-hosted with IP address",
			url:  "https://192.168.1.100/owner/repo",
			want: true,
		},
		{
			name: "valid self-hosted with IP and port",
			url:  "https://192.168.1.100:8443/owner/repo",
			want: true,
		},
		{
			name: "valid self-hosted with IPv6",
			url:  "https://[2001:db8::1]/owner/repo",
			want: true,
		},
		{
			name: "valid self-hosted with IPv6 and port",
			url:  "https://[2001:db8::1]:8443/owner/repo",
			want: true,
		},

		// Invalid URLs
		{
			name: "empty URL",
			url:  "",
			want: false,
		},
		{
			name: "HTTP instead of HTTPS",
			url:  "http://github.com/owner/repo",
			want: false,
		},
		{
			name: "missing scheme",
			url:  "github.com/owner/repo",
			want: false,
		},
		{
			name: "missing host",
			url:  "https:///owner/repo",
			want: false,
		},
		{
			name: "missing path",
			url:  "https://github.com",
			want: false,
		},
		{
			name: "empty path",
			url:  "https://github.com/",
			want: false,
		},
		{
			name: "only owner, no repo",
			url:  "https://github.com/owner",
			want: false,
		},
		{
			name: "invalid characters in host",
			url:  "https://github$.com/owner/repo",
			want: false,
		},
		{
			name: "invalid characters in path - dollar sign",
			url:  "https://github.com/owner$/repo",
			want: false,
		},
		{
			name: "invalid characters in path - spaces",
			url:  "https://github.com/owner name/repo",
			want: false,
		},
		{
			name: "invalid characters in path - special chars",
			url:  "https://github.com/owner@/repo",
			want: false,
		},
		{
			name: "unparseable URL",
			url:  "://not-a-url",
			want: false,
		},
		{
			name: "not a URL at all",
			url:  "just-some-text",
			want: false,
		},
		{
			name: "FTP protocol",
			url:  "ftp://github.com/owner/repo",
			want: false,
		},
		{
			name: "file protocol",
			url:  "file:///path/to/repo",
			want: false,
		},
		{
			name: "owner name too long (>100 chars)",
			url:  "https://github.com/" + string(make([]byte, 101)) + "/repo",
			want: false,
		},
		{
			name: "repo name too long (>100 chars)",
			url:  "https://github.com/owner/" + string(make([]byte, 101)),
			want: false,
		},
		{
			name: "empty owner name",
			url:  "https://github.com//repo",
			want: false,
		},
		{
			name: "empty repo name",
			url:  "https://github.com/owner/",
			want: false,
		},
		{
			name: "consecutive dots in domain",
			url:  "https://github..com/owner/repo",
			want: false,
		},
		{
			name: "domain starting with hyphen",
			url:  "https://-github.com/owner/repo",
			want: false,
		},
		{
			name: "domain ending with hyphen",
			url:  "https://github-.com/owner/repo",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidGitHubURL(tt.url)
			assert.Equal(t, tt.want, got, "URL: %s", tt.url)
		})
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		expectedError bool
		errorContains []string
	}{
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
		},
		{
			name: "non-github repository type",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
				},
			},
		},
		{
			name: "github repository type without github config",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type:   provisioning.GitHubRepositoryType,
					GitHub: nil,
				},
			},
			expectedError: true,
			errorContains: []string{"github config is required"},
		},
		{
			name: "missing URL",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"url"},
		},
		{
			name: "invalid URL format - HTTP instead of HTTPS",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "http://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid GitHub URL format"},
		},
		{
			name: "GitHub Enterprise URL - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.enterprise.com/grafana/grafana",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "Self-hosted instance with port - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://git.company.local:8443/grafana/grafana",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "Self-hosted instance with IP address - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://192.168.1.100:8443/org/repo",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "GitHub.com URL - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Path:   "grafana",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "GitHub.com URL with .git suffix - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
						Path:   "grafana",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "GitHub.com URL with underscores - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana_labs/grafana_app",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "GitHub.com URL with subgroups - valid",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/team/project",
						Branch: "main",
					},
				},
				Secure: provisioning.SecureValues{
					Token: common.InlineSecureValue{
						Create: common.NewSecretValue("test-token"),
					},
				},
			},
		},
		{
			name: "malformed URL - missing owner/repo",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid GitHub URL format"},
		},
		{
			name: "malformed URL - only owner",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid GitHub URL format"},
		},
		{
			name: "malformed URL - invalid characters in owner",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana$/grafana",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid GitHub URL format"},
		},
		{
			name: "malformed URL - invalid characters in repo",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana@",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid GitHub URL format"},
		},
		{
			name: "malformed URL - spaces in path",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana labs/grafana",
						Branch: "main",
					},
				},
			},
			expectedError: true,
			errorContains: []string{"invalid GitHub URL format"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := Validate(context.Background(), tt.obj)
			if tt.expectedError {
				assert.NotEmpty(t, list, "Expected validation errors but got none")
				if len(tt.errorContains) > 0 {
					errStr := list.ToAggregate().Error()
					for _, contains := range tt.errorContains {
						assert.Contains(t, errStr, contains)
					}
				}
			} else {
				assert.Empty(t, list, "Expected no validation errors but got: %v", list)
			}
		})
	}
}
