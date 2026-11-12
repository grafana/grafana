package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestSecureValueWrites(t *testing.T) {
	tests := []struct {
		name   string
		secure any
		want   []string
	}{
		{
			name: "no secure field",
			want: nil,
		},
		{
			name:   "plaintext payload",
			secure: map[string]any{"apiKey": map[string]any{"create": "super-secret"}},
			want:   []string{"apiKey"},
		},
		{
			name:   "removal",
			secure: map[string]any{"apiKey": map[string]any{"remove": true}},
			want:   []string{"apiKey"},
		},
		{
			name:   "reference only",
			secure: map[string]any{"apiKey": map[string]any{"name": "an-existing-value"}},
			want:   nil,
		},
		{
			name:   "empty create is not a write",
			secure: map[string]any{"apiKey": map[string]any{"create": ""}},
			want:   nil,
		},
		{
			name:   "remove false is not a write",
			secure: map[string]any{"apiKey": map[string]any{"remove": false}},
			want:   nil,
		},
		{
			name: "offending keys are sorted, references left out",
			secure: map[string]any{
				"token":             map[string]any{"create": "a"},
				"basicAuthPassword": map[string]any{"remove": true},
				"reference":         map[string]any{"name": "an-existing-value"},
			},
			want: []string{"basicAuthPassword", "token"},
		},
		{
			name:   "unexpected shape is ignored",
			secure: map[string]any{"apiKey": "not-an-object"},
			want:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := map[string]any{"spec": map[string]any{}}
			if tt.secure != nil {
				obj[secureValuesField] = tt.secure
			}
			require.Equal(t, tt.want, secureValueWrites(obj))
		})
	}
}

func TestCheckSecureValues(t *testing.T) {
	tests := []struct {
		name     string
		repoType provisioning.RepositoryType
		secure   map[string]any
		wantErr  string
	}{
		{
			name:     "plaintext payload is rejected",
			repoType: provisioning.GitHubRepositoryType,
			secure:   map[string]any{"apiKey": map[string]any{"create": "super-secret"}},
			wantErr:  "secure values (apiKey) cannot be created or removed from a github repository",
		},
		{
			name:     "removal is rejected -- it deletes a value the file never owned",
			repoType: provisioning.GitRepositoryType,
			secure:   map[string]any{"apiKey": map[string]any{"remove": true}},
			wantErr:  "secure values (apiKey) cannot be created or removed from a git repository",
		},
		{
			name:     "every offending key is listed",
			repoType: provisioning.GitLabRepositoryType,
			secure: map[string]any{
				"token":             map[string]any{"create": "a"},
				"basicAuthPassword": map[string]any{"remove": true},
			},
			wantErr: "secure values (basicAuthPassword, token) cannot be created or removed from a gitlab repository",
		},
		{
			name:     "reference is allowed -- it only reads an existing value",
			repoType: provisioning.GitHubRepositoryType,
			secure:   map[string]any{"apiKey": map[string]any{"name": "an-existing-value"}},
		},
		{
			name:     "a local repository may write secure values",
			repoType: provisioning.LocalRepositoryType,
			secure:   map[string]any{"apiKey": map[string]any{"create": "super-secret"}},
		},
		{
			name:     "a local repository may remove secure values",
			repoType: provisioning.LocalRepositoryType,
			secure:   map[string]any{"apiKey": map[string]any{"remove": true}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := &ParsedResource{
				Repo: provisioning.ResourceRepositoryInfo{Type: tt.repoType},
				Obj: &unstructured.Unstructured{Object: map[string]any{
					secureValuesField: tt.secure,
				}},
			}

			err := checkSecureValues(parsed)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}

			var validationErr *ResourceValidationError
			require.ErrorAs(t, err, &validationErr)
			require.ErrorIs(t, err, ErrSecureValuesNotAllowed)
			require.Contains(t, err.Error(), tt.wantErr)
			require.NotContains(t, err.Error(), "super-secret", "the error must not echo the secret")
			require.NotContains(t, err.Error(), ErrSecureValuesNotAllowed.Error(),
				"the sentinel is for callers to match on, not for the message the API returns")
		})
	}
}
