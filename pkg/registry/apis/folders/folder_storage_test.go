package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSetDefaultPermissionsWhenCreatingFolder(t *testing.T) {
	type testCase struct {
		description                   string
		expectedCallsToSetPermissions int
	}

	tcs := []testCase{
		{
			description:                   "folder creation succeeds, via legacy storage",
			expectedCallsToSetPermissions: 1,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.description, func(t *testing.T) {
			folderPermService := acmock.NewMockedPermissionsService()
			folderPermService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

			cfg := setting.NewCfg()
			f := ini.Empty()
			f.Section("rbac").Key("resources_with_managed_permissions_on_creation").SetValue("folder")
			tempCfg, err := setting.NewCfgFromINIFile(f)
			require.NoError(t, err)
			cfg.RBAC = tempCfg.RBAC

			fs := folderStorage{
				folderPermissionsSvc: folderPermService,
				acService:            actest.FakeService{},
				store:                &fakeStorage{},
				settingsProvider:     setting.ProvideService(cfg),
			}
			obj := &folders.Folder{}

			ctx := request.WithNamespace(context.Background(), "org-2")
			ctx = identity.WithRequester(ctx, &user.SignedInUser{
				UserID: 1,
			})

			out, err := fs.Create(ctx, obj, func(ctx context.Context,
				obj runtime.Object,
			) error {
				return nil
			},
				&metav1.CreateOptions{})

			require.NoError(t, err)
			require.NotNil(t, out)

			folderPermService.AssertNumberOfCalls(t, "SetPermissions", tc.expectedCallsToSetPermissions)
		})
	}
}

var (
	_ rest.Scoper               = (*fakeStorage)(nil)
	_ rest.SingularNameProvider = (*fakeStorage)(nil)
	_ rest.Getter               = (*fakeStorage)(nil)
	_ rest.Lister               = (*fakeStorage)(nil)
	_ rest.Storage              = (*fakeStorage)(nil)
	_ rest.Creater              = (*fakeStorage)(nil)
	_ rest.Updater              = (*fakeStorage)(nil)
	_ rest.GracefulDeleter      = (*fakeStorage)(nil)
)

type fakeStorage struct{}

func (s *fakeStorage) New() runtime.Object {
	return nil
}

func (s *fakeStorage) Destroy() {}

func (s *fakeStorage) NamespaceScoped() bool {
	return true
}

func (s *fakeStorage) GetSingularName() string {
	return ""
}

func (s *fakeStorage) NewList() runtime.Object {
	return nil
}

func (s *fakeStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return nil, nil
}

func (s *fakeStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}

func (s *fakeStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, nil
}

func (s *fakeStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return obj, nil
}

func (s *fakeStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return nil, false, nil
}

func (s *fakeStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, nil
}

func (s *fakeStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}
