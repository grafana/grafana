package query

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var (
	_ rest.Storage              = (*QueryTypeRegistry[any])(nil)
	_ rest.Scoper               = (*QueryTypeRegistry[any])(nil)
	_ rest.SingularNameProvider = (*QueryTypeRegistry[any])(nil)
	_ rest.Lister               = (*QueryTypeRegistry[any])(nil)
	_ rest.Getter               = (*QueryTypeRegistry[any])(nil)
)

type QueryTypeRegistry[Q any] struct {
	resourceInfo   *common.ResourceInfo
	tableConverter rest.TableConvertor
	defs           *query.QueryTypeDefinitionList

	types   map[string]query.QueryTypeSupport[Q]
	creator func() Q
}

func NewQueryTypeRegistry[Q any](vals []query.QueryTypeSupport[Q], creator func() Q) (*QueryTypeRegistry[Q], error) {
	var resourceInfo = query.QueryTypeDefinitionResourceInfo
	keys := make(map[string]query.QueryTypeSupport[Q], len(vals))
	reg := &QueryTypeRegistry[Q]{
		types:          make(map[string]query.QueryTypeSupport[Q], len(vals)),
		creator:        creator,
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		defs: &query.QueryTypeDefinitionList{
			ListMeta: metav1.ListMeta{
				ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
			},
		},
	}
	for _, val := range vals {
		base := val.QueryType()
		reg.types[base] = val

		// Validate the versions
		for _, v := range val.Versions() {
			if keys[v.Name] != nil {
				return reg, fmt.Errorf("duplicate schema found for: %s", v.Name)
			}
			keys[v.Name] = val
			if v.Name != base && !strings.HasPrefix(v.Name, base+"/") {
				return reg, fmt.Errorf("expected prefix: %s/; found %s", base, v.Name)
			}
		}
		reg.defs.Items = append(reg.defs.Items, val.Versions()...)
	}

	return reg, nil
}

func (r *QueryTypeRegistry[Q]) New() runtime.Object {
	return r.resourceInfo.NewFunc()
}

func (r *QueryTypeRegistry[Q]) Destroy() {}

func (r *QueryTypeRegistry[Q]) NamespaceScoped() bool {
	return false
}

func (r *QueryTypeRegistry[Q]) GetSingularName() string {
	return r.resourceInfo.GetSingularName()
}

func (r *QueryTypeRegistry[Q]) NewList() runtime.Object {
	return r.resourceInfo.NewListFunc()
}

func (r *QueryTypeRegistry[Q]) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return r.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (r *QueryTypeRegistry[Q]) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return r.defs, nil
}

// Get implements rest.Getter.
func (r *QueryTypeRegistry[Q]) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return r.GetByName(name)
}

// Get a query type from registered name
func (r *QueryTypeRegistry[Q]) GetByName(name string) (*query.QueryTypeDefinition, error) {
	for idx, v := range r.defs.Items {
		if v.Name == name {
			return &r.defs.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (r *QueryTypeRegistry[Q]) ReadQuery(generic query.GenericDataQuery) (Q, error) {
	base := generic.QueryType
	version := ""
	parts := strings.SplitN(base, "/", 2)
	if len(parts) == 2 {
		base = parts[0]
		version = parts[1]
	}

	qt, ok := r.types[base]
	if !ok {
		return r.creator(), fmt.Errorf("unknown query type")
	}
	return qt.ReadQuery(generic, version)
}

func (r *QueryTypeRegistry[Q]) Definitions() query.QueryTypeDefinitionList {
	all := query.QueryTypeDefinitionList{}
	for _, qt := range r.types {
		all.Items = append(all.Items, qt.Versions()...)
	}
	return all
}

//----

type schemaREST struct{}

var _ = rest.Connecter(&schemaREST{})

func (r *schemaREST) New() runtime.Object {
	return &metav1.Status{} // not really
}

func (r *schemaREST) Destroy() {
}

func (r *schemaREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *schemaREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *schemaREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	dummy := &metav1.Status{
		Message: "TODO....",
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, dummy)
	}), nil
}
