package user

import (
	"context"
	"errors"

	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

// StoreWrapper filters users based on the hidden users configuration.
// It does not enforce any write authorization — those are handled at the API level.
type StoreWrapper struct {
	cfgProvider configprovider.ConfigProvider
	logger      log.Logger
}

var _ storewrapper.ResourceStorageAuthorizer = (*StoreWrapper)(nil)

func NewStoreWrapper(cfgProvider configprovider.ConfigProvider) *StoreWrapper {
	return &StoreWrapper{
		cfgProvider: cfgProvider,
		logger:      log.New("grafana-apiserver.users.storewrapper"),
	}
}

// AfterGet returns NotFound if the user's login is in the hidden users list
// and the requester is not the user themselves.
func (f *StoreWrapper) AfterGet(ctx context.Context, obj runtime.Object) error {
	cfg, err := f.cfgProvider.Get(ctx)
	if err != nil {
		return err
	}
	if len(cfg.HiddenUsers) == 0 {
		return nil
	}

	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}

	u, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	login := u.Spec.Login
	if _, isHidden := cfg.HiddenUsers[login]; isHidden && login != authInfo.GetUsername() {
		return apierrors.NewNotFound(iamv0.UserResourceInfo.GroupResource(), u.Name)
	}

	return nil
}

// FilterList removes hidden users from the list, except for the requester themselves.
func (f *StoreWrapper) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	cfg, err := f.cfgProvider.Get(ctx)
	if err != nil {
		return nil, err
	}
	if len(cfg.HiddenUsers) == 0 {
		return list, nil
	}

	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	userList, ok := list.(*iamv0.UserList)
	if !ok {
		return list, nil
	}

	requesterLogin := authInfo.GetUsername()
	filtered := userList.Items[:0]
	for _, u := range userList.Items {
		if _, isHidden := cfg.HiddenUsers[u.Spec.Login]; !isHidden || u.Spec.Login == requesterLogin {
			filtered = append(filtered, u)
		}
	}
	userList.Items = filtered
	return userList, nil
}

// BeforeCreate returns Forbidden if the new user's login is in the hidden users list.
func (f *StoreWrapper) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	cfg, err := f.cfgProvider.Get(ctx)
	if err != nil {
		return err
	}
	if len(cfg.HiddenUsers) == 0 {
		return nil
	}

	u, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := cfg.HiddenUsers[u.Spec.Login]; isHidden {
		f.logger.Info("blocked create for hidden user", "login", u.Spec.Login, "name", u.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), u.Name, errors.New("operation not permitted"))
	}

	return nil
}

// BeforeUpdate returns Forbidden if the target user is in the hidden users list.
func (f *StoreWrapper) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	cfg, err := f.cfgProvider.Get(ctx)
	if err != nil {
		return err
	}
	if len(cfg.HiddenUsers) == 0 {
		return nil
	}

	u, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := cfg.HiddenUsers[u.Spec.Login]; isHidden {
		f.logger.Info("blocked update for hidden user", "login", u.Spec.Login, "name", u.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), u.Name, errors.New("operation not permitted"))
	}

	return nil
}

// BeforeDelete returns Forbidden if the target user is in the hidden users list.
func (f *StoreWrapper) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	cfg, err := f.cfgProvider.Get(ctx)
	if err != nil {
		return err
	}
	if len(cfg.HiddenUsers) == 0 {
		return nil
	}

	u, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := cfg.HiddenUsers[u.Spec.Login]; isHidden {
		f.logger.Info("blocked delete for hidden user", "login", u.Spec.Login, "name", u.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), u.Name, errors.New("operation not permitted"))
	}

	return nil
}
