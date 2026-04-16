package user

import (
	"context"
	"errors"
	"strings"

	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
)

// StoreWrapper filters users based on the hidden users configuration.
// It does not enforce any write authorization — those are handled at the API level.
type StoreWrapper struct {
	cfgProvider    configprovider.ConfigProvider
	settingService settingsvc.Service
	logger         log.Logger
}

var _ storewrapper.ResourceStorageAuthorizer = (*StoreWrapper)(nil)

func NewStoreWrapper(cfgProvider configprovider.ConfigProvider, settingService settingsvc.Service) *StoreWrapper {
	return &StoreWrapper{
		cfgProvider:    cfgProvider,
		settingService: settingService,
		logger:         log.New("grafana-apiserver.users.storewrapper"),
	}
}

// hiddenUsersSelector selects the hidden_users setting from the users section.
var hiddenUsersSelector = metav1.LabelSelector{
	MatchLabels: map[string]string{
		"section": "users",
		"key":     "hidden_users",
	},
}

// getHiddenUsers returns the set of hidden user logins by querying either the
// local ConfigProvider (single-tenant) or the remote setting.Service (multi-tenant).
func (f *StoreWrapper) getHiddenUsers(ctx context.Context) (map[string]struct{}, error) {
	if f.cfgProvider != nil {
		cfg, err := f.cfgProvider.Get(ctx)
		if err != nil {
			return nil, err
		}
		return cfg.HiddenUsers, nil
	}

	if f.settingService != nil {
		settings, err := f.settingService.List(ctx, hiddenUsersSelector)
		if err != nil {
			return nil, err
		}
		hidden := make(map[string]struct{})
		for _, s := range settings {
			for _, login := range strings.Split(s.Value, ",") {
				login = strings.TrimSpace(login)
				if login != "" {
					hidden[login] = struct{}{}
				}
			}
		}
		return hidden, nil
	}

	return nil, errors.New("user store wrapper: neither cfgProvider nor settingService is configured")
}

// AfterGet returns NotFound if the user's login is in the hidden users list
// and the requester is not the user themselves.
// Service identities (e.g. Zanzana) bypass hidden user filtering entirely.
func (f *StoreWrapper) AfterGet(ctx context.Context, obj runtime.Object) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}

	hiddenUsers, err := f.getHiddenUsers(ctx)
	if err != nil {
		return err
	}
	if len(hiddenUsers) == 0 {
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
	if _, isHidden := hiddenUsers[login]; isHidden && login != authInfo.GetUsername() {
		return apierrors.NewNotFound(iamv0.UserResourceInfo.GroupResource(), u.Name)
	}

	return nil
}

// FilterList removes hidden users from the list, except for the requester themselves.
// Service identities (e.g. Zanzana) bypass hidden user filtering entirely.
func (f *StoreWrapper) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	if identity.IsServiceIdentity(ctx) {
		return list, nil
	}

	hiddenUsers, err := f.getHiddenUsers(ctx)
	if err != nil {
		return nil, err
	}
	if len(hiddenUsers) == 0 {
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
	filtered := make([]iamv0.User, 0, len(userList.Items))
	for _, u := range userList.Items {
		if _, isHidden := hiddenUsers[u.Spec.Login]; !isHidden || u.Spec.Login == requesterLogin {
			filtered = append(filtered, u)
		}
	}
	userList.Items = filtered
	return userList, nil
}

// BeforeCreate returns Forbidden if the new user's login is in the hidden users list.
// Service identities bypass hidden user restrictions.
func (f *StoreWrapper) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}

	hiddenUsers, err := f.getHiddenUsers(ctx)
	if err != nil {
		return err
	}
	if len(hiddenUsers) == 0 {
		return nil
	}

	u, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := hiddenUsers[u.Spec.Login]; isHidden {
		f.logger.Info("blocked create for hidden user", "login", u.Spec.Login, "name", u.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), u.Name, errors.New("operation not permitted"))
	}

	return nil
}

// BeforeUpdate returns Forbidden if the target user (old object) or the new login is in the hidden users list.
// Service identities bypass hidden user restrictions.
func (f *StoreWrapper) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}

	hiddenUsers, err := f.getHiddenUsers(ctx)
	if err != nil {
		return err
	}
	if len(hiddenUsers) == 0 {
		return nil
	}

	oldUser, ok := oldObj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := hiddenUsers[oldUser.Spec.Login]; isHidden {
		f.logger.Info("blocked update for hidden user", "login", oldUser.Spec.Login, "name", oldUser.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), oldUser.Name, errors.New("operation not permitted"))
	}

	// Also check the new object in case the login is being changed to a hidden user's login.
	newUser, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := hiddenUsers[newUser.Spec.Login]; isHidden {
		f.logger.Info("blocked update to hidden user login", "login", newUser.Spec.Login, "name", newUser.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), newUser.Name, errors.New("operation not permitted"))
	}

	return nil
}

// BeforeDelete returns Forbidden if the target user is in the hidden users list.
// Service identities bypass hidden user restrictions.
func (f *StoreWrapper) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}

	hiddenUsers, err := f.getHiddenUsers(ctx)
	if err != nil {
		return err
	}
	if len(hiddenUsers) == 0 {
		return nil
	}

	u, ok := obj.(*iamv0.User)
	if !ok {
		return nil
	}

	if _, isHidden := hiddenUsers[u.Spec.Login]; isHidden {
		f.logger.Info("blocked delete for hidden user", "login", u.Spec.Login, "name", u.Name)
		return apierrors.NewForbidden(iamv0.UserResourceInfo.GroupResource(), u.Name, errors.New("operation not permitted"))
	}

	return nil
}
