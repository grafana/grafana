package accesscontrol

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

var testUser = &models.SignedInUser{
	UserId:  2,
	OrgId:   3,
	OrgName: "TestOrg",
	OrgRole: models.ROLE_VIEWER,
	Login:   "testUser",
	Name:    "Test User",
	Email:   "testuser@example.org",
}

func TestResolveKeywordedScope(t *testing.T) {
	tests := []struct {
		name       string
		user       *models.SignedInUser
		permission Permission
		want       Permission
		wantErr    bool
	}{
		{
			name:       "no scope",
			user:       testUser,
			permission: Permission{Action: "users:read"},
			want:       Permission{Action: "users:read"},
			wantErr:    false,
		},
		{
			name:       "user if resolution",
			user:       testUser,
			permission: Permission{Action: "users:read", Scope: "users:self"},
			want:       Permission{Action: "users:read", Scope: "users:id:2"},
			wantErr:    false,
		},
	}
	for _, tt := range tests {
		var err error
		t.Run(tt.name, func(t *testing.T) {
			resolver := NewScopeResolver()
			scopeModifier := resolver.GetResolveKeywordScopeMutator(tt.user)
			tt.permission.Scope, err = scopeModifier(context.TODO(), tt.permission.Scope)
			if tt.wantErr {
				assert.Error(t, err, "expected an error during the resolution of the scope")
				return
			}
			assert.NoError(t, err)
			assert.EqualValues(t, tt.want, tt.permission, "permission did not match expected resolution")
		})
	}
}

func TestScopeResolver_ResolveAttribute(t *testing.T) {
	// Calls allow us to see how many times the fakeDataSourceResolution has been called
	calls := 0
	fakeDataSourceResolution := func(ctx context.Context, orgID int64, initialScope string) (string, error) {
		calls++
		if initialScope == "datasources:name:testds" {
			return Scope("datasources", "id", "1"), nil
		} else if initialScope == "datasources:name:testds2" {
			return Scope("datasources", "id", "2"), nil
		} else {
			return "", models.ErrDataSourceNotFound
		}
	}

	tests := []struct {
		name          string
		orgID         int64
		evaluator     Evaluator
		wantEvaluator Evaluator
		wantCalls     int
		wantErr       error
	}{
		{
			name:          "should work with scope less permissions",
			evaluator:     EvalPermission("datasources:read"),
			wantEvaluator: EvalPermission("datasources:read"),
			wantCalls:     0,
		},
		{
			name:      "should handle an error",
			orgID:     1,
			evaluator: EvalPermission("datasources:read", Scope("datasources", "name", "testds3")),
			wantErr:   models.ErrDataSourceNotFound,
			wantCalls: 1,
		},
		{
			name:          "should resolve a scope",
			orgID:         1,
			evaluator:     EvalPermission("datasources:read", Scope("datasources", "name", "testds")),
			wantEvaluator: EvalPermission("datasources:read", Scope("datasources", "id", "1")),
			wantCalls:     1,
		},
		{
			name:  "should resolve nested scopes with cache",
			orgID: 1,
			evaluator: EvalAll(
				EvalPermission("datasources:read", Scope("datasources", "name", "testds")),
				EvalAny(
					EvalPermission("datasources:read", Scope("datasources", "name", "testds")),
					EvalPermission("datasources:read", Scope("datasources", "name", "testds2")),
				),
			),
			wantEvaluator: EvalAll(
				EvalPermission("datasources:read", Scope("datasources", "id", "1")),
				EvalAny(
					EvalPermission("datasources:read", Scope("datasources", "id", "1")),
					EvalPermission("datasources:read", Scope("datasources", "id", "2")),
				),
			),
			wantCalls: 2,
		},
	}
	for _, tt := range tests {
		resolver := NewScopeResolver()

		// Reset calls counter
		calls = 0
		// Register a resolution method
		resolver.AddAttributeResolver("datasources:name:", fakeDataSourceResolution)

		// Test
		scopeModifier := resolver.GetResolveAttributeScopeMutator(tt.orgID)
		resolvedEvaluator, err := tt.evaluator.MutateScopes(context.TODO(), scopeModifier)
		if tt.wantErr != nil {
			assert.ErrorAs(t, err, &tt.wantErr, "expected an error during the resolution of the scope")
			return
		}
		assert.NoError(t, err)
		assert.EqualValues(t, tt.wantEvaluator, resolvedEvaluator, "permission did not match expected resolution")

		assert.Equal(t, tt.wantCalls, calls, "cache has not been used")
	}
}

func Test_scopePrefix(t *testing.T) {
	tests := []struct {
		name  string
		scope string
		want  string
	}{
		{
			name:  "empty",
			scope: "",
			want:  "",
		},
		{
			name:  "minimal",
			scope: ":",
			want:  ":",
		},
		{
			name:  "datasources",
			scope: "datasources:",
			want:  "datasources:",
		},
		{
			name:  "datasources name",
			scope: "datasources:name:testds",
			want:  "datasources:name:",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prefix := scopePrefix(tt.scope)

			assert.Equal(t, tt.want, prefix)
		})
	}
}
