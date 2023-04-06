package apiserver

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/k8s/authnz"
	"github.com/grafana/grafana/pkg/services/store/entity"
	userpkg "github.com/grafana/grafana/pkg/services/user"
	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	"k8s.io/apiextensions-apiserver/pkg/storage/filepath"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ customStorage.Storage = (*entityStorage)(nil)

// wrap the filepath storage so we can test overriding functions
type entityStorage struct {
	log            log.Logger
	userService    userpkg.Service
	acService      accesscontrol.Service
	entityStore    entity.EntityStoreServer
	gr             schema.GroupResource
	strategy       customStorage.Strategy
	optsGetter     generic.RESTOptionsGetter
	tableConvertor rest.TableConvertor
	newFunc        customStorage.NewObjectFunc
	newListFunc    customStorage.NewObjectFunc
}

func ProvideStorage(userService userpkg.Service, acService accesscontrol.Service) customStorage.NewStorageFunc {
	return func(
		gr schema.GroupResource,
		strategy customStorage.Strategy,
		optsGetter generic.RESTOptionsGetter,
		tableConvertor rest.TableConvertor,
		newFunc customStorage.NewObjectFunc,
		newListFunc customStorage.NewObjectFunc,
	) (customStorage.Storage, error) {
		fmt.Printf("create storage for GR: %v", gr)

		if gr.Resource != "dashboards" {
			return filepath.Storage(gr, strategy, optsGetter, tableConvertor, newFunc, newListFunc)
		}

		return &entityStorage{
			log:            log.New("k8s.apiserver.storage"),
			userService:    userService,
			acService:      acService,
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

func (s *entityStorage) New() runtime.Object {
	return s.newFunc()
}

func (s *entityStorage) NewList() runtime.Object {
	return s.newListFunc()
}

func (s *entityStorage) ShortNames() []string {
	return s.strategy.ShortNames()
}

func (s *entityStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj := s.newFunc().(*unstructured.Unstructured)
	objMeta, err := meta.Accessor(obj)
	if err != nil {
		return nil, err
	}
	objMeta.SetName(name)
	objMeta.SetNamespace("default")

	user, err := s.getSignedInUser(ctx, obj)
	if err != nil {
		return nil, err
	}

	out, err := s.entityStore.Read(appcontext.WithUser(ctx, user), &entity.ReadEntityRequest{
		GRN: &entity.GRN{
			TenantId: user.OrgID,
			Kind:     strings.ToLower(obj.GetObjectKind().GroupVersionKind().Kind),
			UID:      name, // the UID
		},
		WithBody:   true,
		WithStatus: true,
	})
	if err != nil {
		return nil, err
	}
	if out == nil || out.GRN == nil {
		return nil, apierrors.NewNotFound(s.gr, name)
	}

	objMeta.SetUID(types.UID(out.Guid))
	objMeta.SetResourceVersion(formatResourceVersion(out.Version))

	var spec map[string]interface{}
	err = json.Unmarshal(out.Body, &spec)
	if err != nil {
		return nil, err
	}

	obj.Object["spec"] = spec

	// err = runtime.DefaultUnstructuredConverter.FromUnstructured(uObj.UnstructuredContent(), obj)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to convert to PublicDashboard: %w", err)
	// }

	// if true {
	// 	return nil, apierrors.NewNotFound(s.gr, name)
	// }

	return obj, nil
}

func (s *entityStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, err := s.getSignedInUser(ctx, obj)
	if err != nil {
		return nil, err
	}
	cmd, err := objectToWriteCommand(user.OrgID, obj)
	if err != nil {
		return nil, err
	}
	out, err := s.entityStore.Write(appcontext.WithUser(ctx, user), cmd)
	if err != nil {
		return nil, err
	}

	objMeta, err := meta.Accessor(obj)
	if err != nil {
		return nil, err
	}

	objMeta.SetUID(types.UID(out.GUID))
	objMeta.SetResourceVersion(formatResourceVersion(out.Entity.Version))

	return obj, nil
}

func (s *entityStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented (list)")
}

func (s *entityStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("UPAGE not implemented (" + name + ")")
}

func (s *entityStorage) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("WATCH not implemented")
}

func (s *entityStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("DELETE not implemented (" + name + ")")
}

func (s *entityStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection not implemented")
}

func (s *entityStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *entityStorage) Destroy() {
	// destroy
}

func (s *entityStorage) GetCreateStrategy() rest.RESTCreateStrategy {
	return s.strategy
}

func (s *entityStorage) GetUpdateStrategy() rest.RESTUpdateStrategy {
	return s.strategy
}

func (s *entityStorage) GetDeleteStrategy() rest.RESTDeleteStrategy {
	return s.strategy
}

func (s *entityStorage) GetStrategy() customStorage.Strategy {
	return s.strategy
}

func (s *entityStorage) SetStrategy(strategy customStorage.Strategy) {
	s.strategy = strategy
}

func (s *entityStorage) NamespaceScoped() bool {
	return s.strategy.NamespaceScoped()
}

func (s *entityStorage) getSignedInUser(ctx context.Context, obj runtime.Object) (*userpkg.SignedInUser, error) {
	accessor, err := apimeta.Accessor(obj)
	if err != nil {
		return nil, err
	}
	user, ok := request.UserFrom(ctx)
	if !ok {
		return nil, apierrors.NewForbidden(s.gr, accessor.GetName(), fmt.Errorf("unable to fetch user from context"))
	}

	userQuery := userpkg.GetSignedInUserQuery{}

	if user.GetName() == authnz.ApiServerUser {
		userQuery.OrgID = 1
		userQuery.UserID = 1
	} else if len(user.GetExtra()["user-id"]) == 0 || len(user.GetExtra()["org-id"]) == 0 {
		return nil, fmt.Errorf("insufficient information on user context, couldn't determine UserID and OrgID")
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
		return nil, apierrors.NewForbidden(s.gr, accessor.GetName(), fmt.Errorf("could not determine the user backing the service account: %s", err.Error()))
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if signedInUser.Permissions[signedInUser.OrgID] == nil {
		permissions, err := s.acService.GetUserPermissions(ctx, signedInUser, accesscontrol.Options{})
		if err != nil {
			fmt.Errorf("failed fetching permissions for user: userID=%d, error=%s", signedInUser.UserID, err.Error())
		}
		signedInUser.Permissions[signedInUser.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	return signedInUser, nil
}
