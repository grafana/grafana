package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/admission"
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
		{
			name: "user with read permissions should be able to list folders",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {},
					},
				},
				verb: string(utils.VerbList),
			},
			expect: expect{
				eval:  "folders:read",
				allow: false,
			},
		},
		{
			name: "user with delete permissions should be able to delete a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersDelete: {dashboards.ScopeFoldersAll}, dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbDelete),
			},
			expect: expect{
				eval:  "folders:delete",
				allow: true,
			},
		},
		{
			name: "user without delete permissions should NOT be able to delete a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {},
					},
				},
				verb: string(utils.VerbDelete),
			},
			expect: expect{
				eval:  "folders:delete",
				allow: false,
			},
		},
		{
			name: "user with write permissions should be able to update a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}},
					},
				},
				verb: string(utils.VerbUpdate),
			},
			expect: expect{
				eval:  "folders:write",
				allow: true,
			},
		},
		{
			name: "user without write permissions should NOT be able to update a folder",
			input: input{
				user: &user.SignedInUser{
					UserID: 1,
					OrgID:  orgID,
					Name:   "123",
					Permissions: map[int64]map[string][]string{
						orgID: {},
					},
				},
				verb: string(utils.VerbUpdate),
			},
			expect: expect{
				eval:  "folders:write",
				allow: false,
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

func TestFolderAPIBuilder_Validate(t *testing.T) {
	type input struct {
		obj         *v0alpha1.Folder
		annotations map[string]string
		name        string
	}

	circularObj := &v0alpha1.Folder{
		Spec: v0alpha1.Spec{
			Title: "foo",
		},
	}
	circularObj.Name = "valid-name"
	circularObj.Annotations = map[string]string{"grafana.app/folder": "valid-name"}

	tests := []struct {
		name    string
		input   input
		setupFn func(*mock.Mock)
		err     error
	}{
		{
			name: "should return error when name is invalid",
			input: input{
				obj: &v0alpha1.Folder{
					Spec: v0alpha1.Spec{
						Title: "foo",
					},
				},
				name: folderValidationRules.invalidNames[0],
			},
			err: dashboards.ErrFolderInvalidUID,
		},
		{
			name: "should return no error if every validation passes",
			input: input{
				obj: &v0alpha1.Folder{
					Spec: v0alpha1.Spec{
						Title: "foo",
					},
				},
				name: "valid-name",
			},
		},
		{
			name: "should return error when creating a nested folder higher than max depth",
			input: input{
				obj: &v0alpha1.Folder{
					Spec: v0alpha1.Spec{
						Title: "foo",
					},
				},
				annotations: map[string]string{"grafana.app/folder": "valid-name"},
				name:        "valid-name",
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, "valid-name", mock.Anything).Return(
					circularObj,
					nil)
			},
			err: folder.ErrMaximumDepthReached,
		},
		{
			name: "should return error when title is empty",
			input: input{
				obj: &v0alpha1.Folder{
					Spec: v0alpha1.Spec{
						Title: "",
					},
				},
				name: "foo",
			},
			err: dashboards.ErrFolderTitleEmpty,
		},
	}

	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}

	b := &FolderAPIBuilder{
		gv:            resourceInfo.GroupVersion(),
		features:      nil,
		namespacer:    func(_ int64) string { return "123" },
		folderSvc:     foldertest.NewFakeService(),
		storage:       us,
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.input.obj.Name = tt.input.name
			tt.input.obj.Annotations = tt.input.annotations

			if tt.setupFn != nil {
				tt.setupFn(m)
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.input.obj,
				nil,
				v0alpha1.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.name,
				v0alpha1.SchemeGroupVersion.WithResource("folders"),
				"",
				"create",
				nil,
				true,
				&user.SignedInUser{},
			), nil)

			if tt.err == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tt.err)
				return
			}
		})
	}
}
