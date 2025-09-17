package storage

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	metatable "k8s.io/apimachinery/pkg/api/meta/table"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation"
	"github.com/grafana/grafana/pkg/aggregator/registry/dataplaneservice"
)

// REST implements a RESTStorage for Data Plane services.
type REST struct {
	*genericregistry.Store
}

// NewREST returns a RESTStorage object that will work against Data Plane services.
func NewREST(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter) *REST {
	strategy := dataplaneservice.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &aggregation.DataPlaneService{} },
		NewListFunc:               func() runtime.Object { return &aggregation.DataPlaneServiceList{} },
		PredicateFunc:             dataplaneservice.MatchDataPlaneService,
		DefaultQualifiedResource:  aggregation.Resource("dataplaneservices"),
		SingularQualifiedResource: aggregation.Resource("dataplaneservice"),

		CreateStrategy:      strategy,
		UpdateStrategy:      strategy,
		DeleteStrategy:      strategy,
		ResetFieldsStrategy: strategy,

		TableConvertor: rest.NewDefaultTableConvertor(aggregation.Resource("dataplaneservices")),
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: dataplaneservice.GetAttrs}
	if err := store.CompleteWithOptions(options); err != nil {
		panic(err) // TODO: Propagate error up
	}
	return &REST{store}
}

// Implement CategoriesProvider
var _ rest.CategoriesProvider = &REST{}

// Categories implements the CategoriesProvider interface. Returns a list of categories a resource is part of.
func (c *REST) Categories() []string {
	return []string{"dataplane"}
}

var swaggerMetadataDescriptions = metav1.ObjectMeta{}.SwaggerDoc()

// ConvertToTable implements the TableConvertor interface for REST.
func (c *REST) ConvertToTable(ctx context.Context, obj runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	table := &metav1.Table{
		ColumnDefinitions: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name", Description: swaggerMetadataDescriptions["name"]},
			{Name: "Available", Type: "string", Description: "Whether this service is available."},
			{Name: "Age", Type: "string", Description: swaggerMetadataDescriptions["creationTimestamp"]},
		},
	}
	if m, err := meta.ListAccessor(obj); err == nil {
		table.ResourceVersion = m.GetResourceVersion()
		table.Continue = m.GetContinue()
		table.RemainingItemCount = m.GetRemainingItemCount()
	} else {
		if m, err := meta.CommonAccessor(obj); err == nil {
			table.ResourceVersion = m.GetResourceVersion()
		}
	}

	var err error
	table.Rows, err = metatable.MetaToTableRow(obj, func(obj runtime.Object, m metav1.Object, name, age string) ([]interface{}, error) {
		svc := obj.(*aggregation.DataPlaneService)
		status := string(aggregation.ConditionUnknown)
		if condition := getCondition(svc.Status.Conditions, "Available"); condition != nil {
			switch {
			case condition.Status == aggregation.ConditionTrue:
				status = string(condition.Status)
			case len(condition.Reason) > 0:
				status = fmt.Sprintf("%s (%s)", condition.Status, condition.Reason)
			default:
				status = string(condition.Status)
			}
		}
		return []interface{}{name, status, age}, nil
	})
	return table, err
}

func getCondition(conditions []aggregation.DataPlaneServiceCondition, conditionType aggregation.DataPlaneServiceConditionType) *aggregation.DataPlaneServiceCondition {
	for i, condition := range conditions {
		if condition.Type == conditionType {
			return &conditions[i]
		}
	}
	return nil
}

// NewStatusREST makes a RESTStorage for status that has more limited options.
// It is based on the original REST so that we can share the same underlying store
func NewStatusREST(scheme *runtime.Scheme, rest *REST) *StatusREST {
	strategy := dataplaneservice.NewStatusStrategy(scheme)
	statusStore := *rest.Store
	statusStore.CreateStrategy = nil
	statusStore.DeleteStrategy = nil
	statusStore.UpdateStrategy = strategy
	statusStore.ResetFieldsStrategy = strategy
	return &StatusREST{store: &statusStore}
}

// StatusREST implements the REST endpoint for changing the status of an DataPlaneService.
type StatusREST struct {
	store *genericregistry.Store
}

var _ = rest.Patcher(&StatusREST{})

// New creates a new DataPlaneService object.
func (r *StatusREST) New() runtime.Object {
	return &aggregation.DataPlaneService{}
}

// Destroy cleans up resources on shutdown.
func (r *StatusREST) Destroy() {
	// Given that underlying store is shared with REST,
	// we don't destroy it here explicitly.
}

// Get retrieves the object from the storage. It is required to support Patch.
func (r *StatusREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return r.store.Get(ctx, name, options)
}

// Update alters the status subset of an object.
func (r *StatusREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// We are explicitly setting forceAllowCreate to false in the call to the underlying storage because
	// subresources should never allow create on update.
	return r.store.Update(ctx, name, objInfo, createValidation, updateValidation, false, options)
}

// GetResetFields implements rest.ResetFieldsStrategy
func (r *StatusREST) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return r.store.GetResetFields()
}
