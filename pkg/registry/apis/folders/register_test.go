package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestFolderAPIBuilder_getAuthorizerFunc(t *testing.T) {
	type input struct {
		permissions map[int64]map[string][]string
		verb        string
	}
	type expect struct {
		user identity.Requester
		eval string
	}
	var orgID int64 = 1
	var userInfo = &user.SignedInUser{UserID: 1, Name: "123"}
	tests := []struct {
		name   string
		input  input
		expect expect
	}{
		{
			name: "When creating folder should not return access denied error",
			input: input{
				permissions: map[int64]map[string][]string{
					orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
				},
				verb: string(utils.VerbCreate),
			},
			expect: expect{
				user: userInfo,
				eval: "folders:create",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userInfo.Permissions = tt.input.permissions
			ctx := context.Background()
			_, user, eval, _, _ := authorizerFunc(identity.WithRequester(ctx, userInfo), authorizer.AttributesRecord{User: userInfo, Verb: tt.input.verb, Resource: "folders", ResourceRequest: true, Name: "123"})
			require.Equal(t, tt.expect.user, user)
			require.Equal(t, tt.expect.eval, eval.String())
		})
	}
}
