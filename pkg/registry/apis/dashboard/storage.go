package dashboard

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"k8s.io/apimachinery/pkg/runtime"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
)

var _ grafanarest.Storage = (*storage)(nil)

type storage struct {
	*genericregistry.Store
}

func newStorage(scheme *runtime.Scheme) (*storage, error) {
	strategy := grafanaregistry.NewStrategy(scheme)
	resourceInfo := v0alpha1.DashboardResourceInfo
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}

	store.TableConvertor = utils.NewTableConverter(
		store.DefaultQualifiedResource,
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The dashboard name"},
			{Name: "Created At", Type: "date"},
		},
		func(obj any) ([]interface{}, error) {
			dash, ok := obj.(*v0alpha1.Dashboard)
			if ok {
				if dash != nil {
					return []interface{}{
						dash.Name,
						dash.Spec.GetNestedString("title"),
						dash.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			summary, ok := obj.(*v0alpha1.DashboardSummary)
			if ok {
				return []interface{}{
					dash.Name,
					summary.Spec.Title,
					dash.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected dashboard or summary")
		})
	return &storage{Store: store}, nil
}

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func (s *storage) Compare(storageObj, legacyObj runtime.Object) bool {
	//TODO: define the comparison logic between a dashboard returned by the storage and a dashboard returned by the legacy storage
	return false
}
