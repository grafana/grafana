package user

import (
	"context"

	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/setting"
)

// StoreWrapper filters users based on the hidden users configuration.
// It does not enforce any write authorization — those are handled at the API level.
type StoreWrapper struct {
	cfg *setting.Cfg
}

var _ storewrapper.ResourceStorageAuthorizer = (*StoreWrapper)(nil)

func NewStoreWrapper(cfg *setting.Cfg) *StoreWrapper {
	return &StoreWrapper{cfg: cfg}
}

// AfterGet returns NotFound if the user's login is in the hidden users list
// and the requester is not the user themselves.
func (f *StoreWrapper) AfterGet(ctx context.Context, obj runtime.Object) error {
	if len(f.cfg.HiddenUsers) == 0 {
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
	if _, isHidden := f.cfg.HiddenUsers[login]; isHidden && login != authInfo.GetUsername() {
		return apierrors.NewNotFound(iamv0.UserResourceInfo.GroupResource(), u.Name)
	}

	return nil
}

// FilterList removes hidden users from the list, except for the requester themselves.
func (f *StoreWrapper) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	if len(f.cfg.HiddenUsers) == 0 {
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
		if _, isHidden := f.cfg.HiddenUsers[u.Spec.Login]; !isHidden || u.Spec.Login == requesterLogin {
			filtered = append(filtered, u)
		}
	}
	userList.Items = filtered
	return userList, nil
}

// BeforeCreate is a no-op; write authorization is handled at the API level.
func (f *StoreWrapper) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return nil
}

// BeforeUpdate is a no-op; write authorization is handled at the API level.
func (f *StoreWrapper) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return nil
}

// BeforeDelete is a no-op; write authorization is handled at the API level.
func (f *StoreWrapper) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return nil
}
