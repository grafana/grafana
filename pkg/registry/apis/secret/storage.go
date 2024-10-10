package secret

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ rest.Scoper               = (*secretStorage)(nil)
	_ rest.SingularNameProvider = (*secretStorage)(nil)
	_ rest.Getter               = (*secretStorage)(nil)
	_ rest.Lister               = (*secretStorage)(nil)
	_ rest.Storage              = (*secretStorage)(nil)
	_ rest.Creater              = (*secretStorage)(nil)
	_ rest.Updater              = (*secretStorage)(nil)
	_ rest.GracefulDeleter      = (*secretStorage)(nil)
)

type secretStorage struct {
	store          secretstore.SecureValueStore
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

func (s *secretStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

func (s *secretStorage) Destroy() {}

func (s *secretStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *secretStorage) GetSingularName() string {
	return s.resource.GetSingularName()
}

func (s *secretStorage) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

func (s *secretStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *secretStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns := request.NamespaceValue(ctx)
	return s.store.List(ctx, ns, options)
}

func (s *secretStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns := request.NamespaceValue(ctx)
	v, err := s.store.Read(ctx, ns, name)
	if v == nil {
		return nil, s.resource.NewNotFound(name)
	}
	return v, err
}

func checkPathOrValue(s *secret.SecureValue, mustExist bool) error {
	p := s.Spec.Path
	v := s.Spec.Value

	if p == "" && v == "" {
		if mustExist {
			return fmt.Errorf("expecting path or value to exist")
		}
		return nil
	}

	if p != "" && v != "" {
		return fmt.Errorf("only path *or* value may be configured at the same time")
	}
	return nil
}

func (s *secretStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secret.SecureValue)
	if !ok {
		return nil, fmt.Errorf("expected SecureValue for create")
	}

	err := checkPathOrValue(sv, true)
	if err != nil {
		return nil, err
	}

	if sv.Name == "" {
		r, err := util.GetRandomString(8)
		if err != nil {
			return nil, err
		}
		if sv.GenerateName == "" {
			sv.GenerateName = "s"
		}
		sv.Name = sv.GenerateName + r
	}

	return s.store.Create(ctx, sv)
}

func (s *secretStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	old, _ := s.Get(ctx, name, nil)
	if old == nil {
		old = &secret.SecureValue{}
	}

	// makes sure the UID and RV are OK
	tmp, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}

	obj, ok := tmp.(*secret.SecureValue)
	if !ok {
		return nil, false, fmt.Errorf("expected SecureValue for update")
	}

	err = checkPathOrValue(obj, false)
	if err != nil {
		return nil, false, err
	}

	// Don't compare automatically set fields
	obj.Annotations = secretstore.CleanAnnotations(obj.Annotations)

	// Is this really a create request
	if obj.UID == "" {
		n, err := s.Create(ctx, obj, nil, &metav1.CreateOptions{})
		return n, true, err
	}

	// short circuit when no changes to JSON
	if obj.Spec.Value == "" {
		oldjson, _ := json.Marshal(old)
		newjson, _ := json.Marshal(obj)
		if bytes.Equal(oldjson, newjson) && len(newjson) > 0 {
			return old, false, nil
		}
	}

	obj, err = s.store.Update(ctx, obj)
	return obj, false, err
}

// GracefulDeleter
func (s *secretStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	ns := request.NamespaceValue(ctx)
	return s.store.Delete(ctx, ns, name)
}

// CollectionDeleter
func (s *secretStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for secrets not implemented")
}
