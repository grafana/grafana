package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestFolderAPIBuilder_getAuthorizerFunc(t *testing.T) {
	type input struct {
		user identity.Requester
		verb string
	}
	type expect struct {
		eval  string
		allow bool
		err   error
	}
	var orgID int64 = 1

	tests := []struct {
		name   string
		input  input
		expect expect
	}{
		{
			name: "user with create permissions should be able to create a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbCreate),
			},
			expect: expect{
				eval:  "folders:create",
				allow: true,
			},
		},
		{
			name: "not possible to create a folder without a user",
			input: input{
				user: nil,
				verb: string(utils.VerbCreate),
			},
			expect: expect{
				eval: "folders:create",
				err:  errNoUser,
			},
		},
		{
			name: "user without permissions should not be able to create a folder",
			input: input{
				user: &user.SignedInUser{},
				verb: string(utils.VerbCreate),
			},
			expect: expect{
				eval: "folders:create",
			},
		},
		{
			name: "user in another orgId should not be able to create a folder ",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  2,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbCreate),
			},
			expect: expect{
				eval: "folders:create",
			},
		},
	}

	b := &FolderAPIBuilder{
		gv:            resourceInfo.GroupVersion(),
		features:      nil,
		namespacer:    func(_ int64) string { return "123" },
		folderSvc:     foldertest.NewFakeService(),
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			out, err := authorizerFunc(identity.WithRequester(ctx, tt.input.user), authorizer.AttributesRecord{User: tt.input.user, Verb: tt.input.verb, Resource: "folders", ResourceRequest: true, Name: "123"})
			if tt.expect.err != nil {
				require.Error(t, err)
				return
			}
			allow, _ := b.accessControl.Evaluate(ctx, out.user, out.evaluator)
			require.NoError(t, err)
			require.Equal(t, tt.expect.eval, out.evaluator.String())
			require.Equal(t, tt.expect.allow, allow)
		})
	}
}
