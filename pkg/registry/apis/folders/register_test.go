package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestFolderAPIBuilder_getAuthorizerFunc(t *testing.T) {
	type expected struct {
		user      identity.Requester
		eval      authorizer.Attributes
		decision  authorizer.Decision
		requester string
	}
	var ctx = context.Background()
	tests := []struct {
		name  string
		input context.Context
		want  expected
	}{
		{
			name:  "When creating folder should not return access denied error",
			input: identity.WithRequester(ctx, &user.SignedInUser{}),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			_, user, eval, decision, requester := authorizerFunc(tt.input, authorizer.AttributesRecord{})
			// require.NotNil(t, )
		})
	}
}
