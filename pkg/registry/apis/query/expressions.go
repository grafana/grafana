package query

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/validation/spec"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/expr"
)

var (
	_ rest.Storage              = (*exprStorage)(nil)
	_ rest.Scoper               = (*exprStorage)(nil)
	_ rest.SingularNameProvider = (*exprStorage)(nil)
	_ rest.Lister               = (*exprStorage)(nil)
	_ rest.Getter               = (*exprStorage)(nil)
)

type exprStorage struct {
	resourceInfo   *common.ResourceInfo
	tableConverter rest.TableConvertor
	handler        *expr.ExpressionQueyHandler
}

func newExprStorage() (*exprStorage, error) {
	handler, err := expr.NewQueryHandler()
	if err != nil {
		return nil, err
	}

	var resourceInfo = common.NewResourceInfo(query.GROUP, query.VERSION,
		"expressions", "expression", "DataSourceApiServer",
		func() runtime.Object { return &query.QueryTypeDefinition{} },
		func() runtime.Object { return &query.QueryTypeDefinitionList{} },
	)
	return &exprStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
		handler:        handler,
	}, err
}

func (s *exprStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *exprStorage) Destroy() {}

func (s *exprStorage) NamespaceScoped() bool {
	return false
}

func (s *exprStorage) GetSingularName() string {
	return example.DummyResourceInfo.GetSingularName()
}

func (s *exprStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *exprStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *exprStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.handler.QueryTypeDefinitionList(), nil
}

func (s *exprStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	expr := s.handler.QueryTypeDefinitionList()
	for idx, flag := range expr.Items {
		if flag.Name == name {
			return &expr.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (b *QueryAPIBuilder) handleExpressionsSchema(w http.ResponseWriter, r *http.Request) {
	generic := query.GenericDataQuery{}.OpenAPIDefinition().Schema
	delete(generic.VendorExtensible.Extensions, "x-kubernetes-preserve-unknown-fields")
	generic.ID = ""
	generic.Schema = ""

	s := spec.Schema{
		SchemaProps: spec.SchemaProps{
			Type:        []string{"object"},
			Properties:  make(map[string]spec.Schema),
			Definitions: make(spec.Definitions),
		},
	}

	queryTypeEnum := spec.StringProperty().WithDescription("Query type selector")

	common := make(map[string]spec.Schema)
	for k, v := range generic.Properties {
		if k == "queryType" {
			continue
		}

		s.Definitions[k] = v
		common[k] = *spec.RefProperty("#/definitions/" + k)
	}

	// //	refId := s.Properties["refId"]
	// ds := generic.Properties["datasource"]
	// t := ds.Properties["uid"]
	// t.AddExtension("const", "expr") // must be the constant value

	// s := generic
	// delete(s.Properties, "queryType") // gets replaced

	// generic.Properties["resultAssertions"] = *spec.RefProperty("#/definitions/resultAssertions")
	// generic.Properties["timeRange"] = *spec.RefProperty("#/definitions/timeRange")

	for _, qt := range b.handler.QueryTypeDefinitionList().Items {
		discriminator := qt.Spec.DiscriminatorField
		if discriminator == "" {
			discriminator = "queryType"
		}
		s.WithDiscriminator(discriminator)

		for _, ver := range qt.Spec.Versions {
			key := qt.Name
			if ver.Version != "" {
				key = fmt.Sprintf("%s/%s", qt.Name, ver.Version)
			}
			queryTypeEnum.Enum = append(queryTypeEnum.Enum, key)

			node := spec.Schema{}
			_ = json.Unmarshal(ver.Schema, &node)
			t := spec.StringProperty().WithDescription(key)
			t.WithPattern(`^` + key + `$`) // no const value

			node.Properties[discriminator] = *t
			node.Required = append(node.Required, discriminator, "refId")

			for k, v := range common {
				_, found := node.Properties[k]
				if found {
					continue
				}
				node.Properties[k] = v
			}

			s.OneOf = append(s.OneOf, node)
		}
	}

	s.Properties["queryType"] = *queryTypeEnum

	json.NewEncoder(w).Encode(s)
}
