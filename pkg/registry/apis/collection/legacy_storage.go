package collection

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	collection "github.com/grafana/grafana/pkg/apis/collection/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

var resourceInfo = collection.StarsResourceInfo

type legacyStorage struct {
	reg            *CollectionAPIBuilder
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	stars, err := s.getMyStars(ctx)
	if err != nil {
		return nil, err
	}
	return &collection.StarsList{
		ListMeta: metav1.ListMeta{},
		Items:    []collection.Stars{*stars},
	}, nil
}

func (s *legacyStorage) getMyStars(ctx context.Context) (*collection.Stars, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	return &collection.Stars{
		ObjectMeta: metav1.ObjectMeta{
			Name:              user.UserUID,
			ResourceVersion:   "1",
			CreationTimestamp: metav1.NewTime(time.Now()),
			UID:               "XX", // hash
			Namespace:         s.reg.namespacer(user.OrgID),
		},
		Spec: collection.StarsSpec{
			Dashboards:   []string{},
			QueryHistory: []string{},
		},
	}, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// name <> user_uid ????

	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return &collection.Stars{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			ResourceVersion:   "1",
			CreationTimestamp: metav1.NewTime(time.Now()),
			UID:               "XX", // hash
			Namespace:         info.Value,
		},
		Spec: collection.StarsSpec{
			Dashboards:   []string{},
			QueryHistory: []string{},
		},
	}, nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	fmt.Printf("TODO.. create: %v\n", info)
	return nil, fmt.Errorf("TODO")
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	created := false
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, created, err
	}

	if true {
		fmt.Printf("TODO.. update: %v\n", obj)
		return nil, false, fmt.Errorf("TODO")
	}

	r, err := s.Get(ctx, name, nil)
	return r, created, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}

	fmt.Printf("TODO.. delete: %v\n", v)
	return v, true, fmt.Errorf("TODO, actually delete") // true is instant delete
}
