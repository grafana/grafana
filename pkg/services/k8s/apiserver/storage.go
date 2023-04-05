package apiserver

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/k8s/authnz"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"

	grafanaUser "github.com/grafana/grafana/pkg/services/user"
	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ customStorage.Storage = (*Storage)(nil)

// wrap the filepath storage so we can test overriding functions
type Storage struct {
	log            log.Logger
	groupResource  schema.GroupResource
	userService    grafanaUser.Service
	entityStore    entity.EntityStoreServer
	gr             schema.GroupResource
	strategy       customStorage.Strategy
	optsGetter     generic.RESTOptionsGetter
	tableConvertor rest.TableConvertor
	newFunc        customStorage.NewObjectFunc
	newListFunc    customStorage.NewObjectFunc
}

func ProvideStorage(userService grafanaUser.Service) customStorage.NewStorageFunc {
	return func(
		gr schema.GroupResource,
		strategy customStorage.Strategy,
		optsGetter generic.RESTOptionsGetter,
		tableConvertor rest.TableConvertor,
		newFunc customStorage.NewObjectFunc,
		newListFunc customStorage.NewObjectFunc,
	) (customStorage.Storage, error) {
		fmt.Printf("create storage for GR: %v", gr)
		return &Storage{
			log:            log.New("k8s.apiserver.storage"),
			groupResource:  gr,
			userService:    userService,
			entityStore:    entity.WireCircularDependencyHack,
			gr:             gr,
			strategy:       strategy,
			optsGetter:     optsGetter,
			tableConvertor: tableConvertor,
			newFunc:        newFunc,
			newListFunc:    newListFunc,
		}, nil
	}
}

func (s *Storage) New() runtime.Object {
	return s.newFunc()
}

func (s *Storage) NewList() runtime.Object {
	return s.newListFunc()
}

func (s *Storage) ShortNames() []string {
	return s.strategy.ShortNames()
}

func (s *Storage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *Storage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, err := s.getSignedInUser(ctx, obj)
	if err != nil {
		return nil, err
	}

	s.log.Debug("Create called", "user", user.UserID, "org", user.OrgID, "kind", obj.GetObjectKind().GroupVersionKind().Kind)

	return nil, fmt.Errorf("not implemented")
}

func (s *Storage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *Storage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("not implemented")
}

func (s *Storage) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *Storage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("not implemented")
}

func (s *Storage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *Storage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *Storage) Destroy() {
}

func (s *Storage) GetCreateStrategy() rest.RESTCreateStrategy {
	return s.strategy
}

func (s *Storage) GetUpdateStrategy() rest.RESTUpdateStrategy {
	return s.strategy
}

func (s *Storage) GetDeleteStrategy() rest.RESTDeleteStrategy {
	return s.strategy
}

func (s *Storage) GetStrategy() customStorage.Strategy {
	return s.strategy
}

func (s *Storage) SetStrategy(strategy customStorage.Strategy) {
	s.strategy = strategy
}

func (s *Storage) NamespaceScoped() bool {
	return s.strategy.NamespaceScoped()
}

func (s *Storage) getSignedInUser(ctx context.Context, obj runtime.Object) (*user.SignedInUser, error) {
	accessor, err := apimeta.Accessor(obj)
	if err != nil {
		return nil, err
	}
	user, ok := request.UserFrom(ctx)
	if !ok {
		return nil, apierrors.NewForbidden(s.groupResource, accessor.GetName(), fmt.Errorf("unable to fetch user from context"))
	}

	userQuery := grafanaUser.GetSignedInUserQuery{}

	if user.GetName() == authnz.ApiServerUser {
		userQuery.OrgID = 1
		userQuery.UserID = 1
		//return nil, apierrors.NewForbidden(s.groupResource, accessor.GetName(), fmt.Errorf("unable to convert k8s service account to Grafana user"))
	} else {
		userQuery.UserID, err = strconv.ParseInt(user.GetExtra()["user-id"][0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana user id from extras map")
		}

		userQuery.OrgID, err = strconv.ParseInt(user.GetExtra()["org-id"][0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana org id from extras map")
		}
	}

	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &userQuery)
	if err != nil {
		return nil, apierrors.NewForbidden(s.groupResource, accessor.GetName(), fmt.Errorf("could not determine the user backing the service account: %s", err.Error()))
	}

	return signedInUser, nil
}
