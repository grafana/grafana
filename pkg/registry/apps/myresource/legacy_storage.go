package myresource

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	myresource "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var errNotFound = errors.New("my resource not found")

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	store          *store
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return myresource.MyResourceKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(myresource.MyResourceKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return myresource.MyResourceKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := s.store.List(ctx, orgID)
	if err != nil {
		return nil, err
	}

	list := &myresource.MyResourceList{}
	for _, row := range rows {
		list.Items = append(list.Items, *convertToK8sResource(row, s.namespacer))
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	row, err := s.store.Get(ctx, requester.GetOrgID(), name)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return nil, k8serrors.NewNotFound(myresource.MyResourceKind().GroupVersionResource().GroupResource(), name)
		}
		return nil, err
	}

	return convertToK8sResource(row, s.namespacer), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}

	p, ok := obj.(*myresource.MyResource)
	if !ok {
		return nil, fmt.Errorf("expected MyResource object")
	}

	uid := p.Name
	if uid == "" {
		return nil, fmt.Errorf("name is required")
	}

	createdBy, _ := requester.GetInternalID()

	row := &myResourceRow{
		OrgId:     requester.GetOrgID(),
		Uid:       uid,
		Title:     p.Spec.Title,
		Content:   p.Spec.Content,
		Ready:     false,
		CreatedBy: createdBy,
	}

	if err := s.store.Insert(ctx, row); err != nil {
		return nil, err
	}

	return s.Get(ctx, uid, nil)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	oldRow, err := s.store.Get(ctx, requester.GetOrgID(), name)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return nil, false, k8serrors.NewNotFound(myresource.MyResourceKind().GroupVersionResource().GroupResource(), name)
		}
		return nil, false, err
	}

	oldObj := convertToK8sResource(oldRow, s.namespacer)
	updatedObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}

	p, ok := updatedObj.(*myresource.MyResource)
	if !ok {
		return nil, false, fmt.Errorf("expected MyResource object")
	}

	oldRow.Title = p.Spec.Title
	oldRow.Content = p.Spec.Content

	if err := s.store.Update(ctx, oldRow); err != nil {
		return nil, false, err
	}

	result, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}
	return result, true, nil
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	if err := s.store.Delete(ctx, requester.GetOrgID(), name); err != nil {
		return nil, false, err
	}

	return obj, true, nil
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for myresource not implemented")
}

func convertToK8sResource(row *myResourceRow, namespacer request.NamespaceMapper) *myresource.MyResource {
	resourceVersion := fmt.Sprintf("%d", row.UpdatedAt)
	if row.UpdatedAt == 0 {
		resourceVersion = fmt.Sprintf("%d", time.Now().Unix())
	}

	return &myresource.MyResource{
		ObjectMeta: metav1.ObjectMeta{
			Name:              row.Uid,
			ResourceVersion:   resourceVersion,
			CreationTimestamp: metav1.NewTime(time.Unix(row.CreatedAt, 0)),
			Namespace:         namespacer(row.OrgId),
		},
		Spec: myresource.MyResourceSpec{
			Title:   row.Title,
			Content: row.Content,
		},
		Status: myresource.MyResourceStatus{
			Ready: row.Ready,
		},
	}
}
