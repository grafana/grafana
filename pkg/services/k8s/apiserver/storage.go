package apiserver

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/k8s/authnz"
	"strconv"

	grafanaUser "github.com/grafana/grafana/pkg/services/user"
	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	"k8s.io/apiextensions-apiserver/pkg/storage/filepath"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ customStorage.Storage = (*Storage)(nil)

// wrap the filepath storage so we can test overriding functions
type Storage struct {
	customStorage.Storage
	groupResource schema.GroupResource
}

// this is called before the apiserver starts up
var NewStorage customStorage.NewStorageFunc = func(
	gr schema.GroupResource,
	strategy customStorage.Strategy,
	optsGetter generic.RESTOptionsGetter,
	tableConvertor rest.TableConvertor,
	newFunc, newListFunc customStorage.NewObjectFunc,
) (customStorage.Storage, error) {
	s, err := filepath.Storage(gr, strategy, optsGetter, tableConvertor, newFunc, newListFunc)
	if err != nil {
		return nil, err
	}

	return &Storage{
		Storage:       s,
		groupResource: gr,
	}, nil
}

// test to override the storage function from the filepath storage
func (s *Storage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, ok := request.UserFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("couldn't determine the K8s user")
	}

	// Run the Grafana RBAC for GLSA token based direct kubectl access only
	if user.GetName() != authnz.ApiServerUser && len(user.GetExtra()["user-id"]) != 0 && len(user.GetExtra()["org-id"]) != 0 {
		accessor, err := apimeta.Accessor(obj)

		if err != nil {
			fmt.Errorf("error determining accessor: %s", err.Error())
			return nil, err
		}

		userId, err := strconv.Atoi(user.GetExtra()["user-id"][0])
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana user id from extras map")
		}

		orgId, _ := strconv.Atoi(user.GetExtra()["org-id"][0])
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana org id from extras map")
		}

		signedInUser := grafanaUser.SignedInUser{
			UserID: int64(userId),
			OrgID:  int64(orgId),
		}

		// TODO: permissions are currently empty, somehow set them using accesscontrol service
		// signedInUser.Permissions = accesscontrol.GetUserPermissions

		dg, err := guardian.New(ctx, 0, int64(orgId), &signedInUser)
		if err != nil {
			return nil, fmt.Errorf("couldn't initialize permissions guardian for this request")
		}

		allowed, err := dg.CanCreate(0, false)
		if err != nil {
			fmt.Errorf("error running permission evaluation: %s", err.Error())
			return nil, err
		}

		if !allowed {
			return nil, apierrors.NewForbidden(s.groupResource, accessor.GetName(), fmt.Errorf("serviceaccount does not have enough permissions to fulfill this operation"))
		}
	}

	return s.Storage.Create(ctx, obj, createValidation, options)
}
