package folders

import (
	"context"
	"testing"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestFolderAPIBuilder_getAuthorizerFunc(t *testing.T) {
	tests := []struct {
		name         string
		inputContext context.Context
		inputAttr    authorizer.Attributes
		want         authorizer.Authorizer
	}{
		{
			name: "When creating folder should not return access denied error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			_, user, eval, decision, requester := authorizerFunc(tt.inputContext, tt.inputAttr)
			// require.NotNil(t, )
		})
	}
}
