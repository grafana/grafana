package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func TestFolderAPIBuilder_Validate_Create(t *testing.T) {
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
			name: "should not allow creating a folder in a tree that is too deep",
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
				"CREATE",
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

func TestFolderAPIBuilder_Validate_Delete(t *testing.T) {
	tests := []struct {
		name          string
		statsResponse *resource.ResourceStatsResponse_Stats
		wantErr       bool
	}{
		{
			name:          "should allow deletion when folder is empty",
			statsResponse: &resource.ResourceStatsResponse_Stats{Count: 0},
		},
		{
			name:          "should return folder not empty when the folder is not empty",
			statsResponse: &resource.ResourceStatsResponse_Stats{Count: 2},
			wantErr:       true,
		},
	}

	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}
	sm := searcherMock{Mock: m}

	obj := &v0alpha1.Folder{
		Spec: v0alpha1.Spec{
			Title: "foo",
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "stacks-123",
			Name:      "valid-name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var setupFn = func(m *mock.Mock, stats *resource.ResourceStatsResponse_Stats) {
				m.On("GetStats", mock.Anything, &resource.ResourceStatsRequest{Namespace: obj.Namespace, Folder: obj.Name}).Return(
					&resource.ResourceStatsResponse{Stats: []*resource.ResourceStatsResponse_Stats{stats}},
					nil,
				).Once()
			}

			setupFn(m, tt.statsResponse)

			b := &FolderAPIBuilder{
				gv:            resourceInfo.GroupVersion(),
				features:      nil,
				namespacer:    func(_ int64) string { return "123" },
				folderSvc:     foldertest.NewFakeService(),
				storage:       us,
				accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
				searcher:      sm,
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				obj,
				nil,
				v0alpha1.SchemeGroupVersion.WithKind("folder"),
				obj.Namespace,
				obj.Name,
				v0alpha1.SchemeGroupVersion.WithResource("folders"),
				"",
				"DELETE",
				nil,
				true,
				&user.SignedInUser{},
			),
				nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Validate_Update(t *testing.T) {
	var circularObj = &v0alpha1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   "stacks-123",
			Name:        "new-parent",
			Annotations: map[string]string{"grafana.app/folder": "new-parent"},
		},
	}

	tests := []struct {
		name       string
		updatedObj *v0alpha1.Folder
		expected   *v0alpha1.Folder
		setupFn    func(*mock.Mock)
		wantErr    bool
	}{
		{
			name: "should allow updating a folder spec",
			updatedObj: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "different title",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
			expected: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "different title",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
		},
		{
			name: "updated title should not be empty",
			updatedObj: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
			wantErr: true,
		},
		{
			name: "should allow moving to a valid parent",
			updatedObj: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "new-parent"},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, "new-parent", mock.Anything).Return(
					&v0alpha1.Folder{},
					nil).Once()
			},
		},
		{
			name: "should not allow moving to a k6 folder",
			updatedObj: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": accesscontrol.K6FolderUID},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, accesscontrol.K6FolderUID, mock.Anything).Return(
					&v0alpha1.Folder{},
					nil).Once()
			},
			wantErr: true,
		},
		{
			name: "should not allow moving to a folder that is too deep",
			updatedObj: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "new-parent"},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, "new-parent", mock.Anything).Return(
					circularObj,
					nil)
			},
			wantErr: true,
		},
	}

	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}
	sm := searcherMock{Mock: m}

	obj := &v0alpha1.Folder{
		Spec: v0alpha1.Spec{
			Title: "foo",
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   "stacks-123",
			Name:        "valid-name",
			Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
		},
	}

	for _, tt := range tests {
		if tt.setupFn != nil {
			tt.setupFn(m)
		}
		t.Run(tt.name, func(t *testing.T) {
			b := &FolderAPIBuilder{
				gv:            resourceInfo.GroupVersion(),
				features:      nil,
				namespacer:    func(_ int64) string { return "123" },
				folderSvc:     foldertest.NewFakeService(),
				storage:       us,
				accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
				searcher:      sm,
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.updatedObj,
				obj,
				v0alpha1.SchemeGroupVersion.WithKind("folder"),
				tt.updatedObj.Namespace,
				tt.updatedObj.Name,
				v0alpha1.SchemeGroupVersion.WithResource("folders"),
				"",
				"UPDATE",
				nil,
				true,
				&user.SignedInUser{},
			),
				nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Mutate_Create(t *testing.T) {
	tests := []struct {
		name     string
		input    *v0alpha1.Folder
		expected *v0alpha1.Folder
		wantErr  bool
	}{
		{
			name: "should trim a title",
			input: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "  foo  ",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			expected: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "foo",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
		},
		{
			name: "should return error if title doesnt exist",
			input: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
		{
			name: "should return error if spec doesnt exist",
			input: &v0alpha1.Folder{
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
	}
	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}
	sm := searcherMock{Mock: m}
	b := &FolderAPIBuilder{
		gv:            resourceInfo.GroupVersion(),
		features:      nil,
		namespacer:    func(_ int64) string { return "123" },
		folderSvc:     foldertest.NewFakeService(),
		storage:       us,
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
		searcher:      sm,
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.input,
				nil,
				v0alpha1.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.Name,
				v0alpha1.SchemeGroupVersion.WithResource("folders"),
				"",
				"CREATE",
				nil,
				true,
				&user.SignedInUser{},
			), nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Mutate_Update(t *testing.T) {
	existingObj := &v0alpha1.Folder{
		Spec: v0alpha1.Spec{
			Title: "some title",
		},
		TypeMeta: metav1.TypeMeta{
			Kind: "Folder",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: "valid-name",
		},
	}
	tests := []struct {
		name     string
		input    *v0alpha1.Folder
		expected *v0alpha1.Folder
		wantErr  bool
	}{
		{
			name: "should trim a title",
			input: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "  foo  ",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			expected: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{
					Title: "foo",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
		},
		{
			name: "should return error if title doesnt exist",
			input: &v0alpha1.Folder{
				Spec: v0alpha1.Spec{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
		{
			name: "should return error if spec doesnt exist",
			input: &v0alpha1.Folder{
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
	}
	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}
	sm := searcherMock{Mock: m}
	b := &FolderAPIBuilder{
		gv:            resourceInfo.GroupVersion(),
		features:      nil,
		namespacer:    func(_ int64) string { return "123" },
		folderSvc:     foldertest.NewFakeService(),
		storage:       us,
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures("nestedFolders"), zanzana.NewNoopClient()),
		searcher:      sm,
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.input,
				existingObj,
				v0alpha1.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.Name,
				v0alpha1.SchemeGroupVersion.WithResource("folders"),
				"",
				"UPDATE",
				nil,
				true,
				&user.SignedInUser{},
			), nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
