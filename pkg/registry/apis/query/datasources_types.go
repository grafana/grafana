package query

import (
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

const (
	dataSourceKind     = "DataSource"
	dataSourceListKind = "DataSourceList"
)

// dataSourceMetadata is a datasource without its spec and secure values. Its apiVersion names the
// group that serves and writes the datasource.
type dataSourceMetadata struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
}

func (dataSourceMetadata) OpenAPIModelName() string {
	return datasourceV0.OpenAPIPrefix + "DataSourceMetadata"
}

func (in *dataSourceMetadata) DeepCopyObject() runtime.Object {
	out := *in
	in.DeepCopyInto(&out.ObjectMeta)
	return &out
}

// pointAtServingGroup sets the identity of the object to the group named by its label.
// An object without the label keeps the group it was read from.
func (in *dataSourceMetadata) pointAtServingGroup() {
	plugin := in.Labels[datasourceV0.LabelKeyGroup]
	if plugin == "" {
		return
	}
	in.APIVersion = plugin + "." + datasourceV0.GROUP + "/" + datasourceV0.VERSION
	in.Kind = dataSourceKind
}

type dataSourceMetadataList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitzero,omitempty"`

	Items []dataSourceMetadata `json:"items"`
}

func (dataSourceMetadataList) OpenAPIModelName() string {
	return datasourceV0.OpenAPIPrefix + "DataSourceMetadataList"
}

func (in *dataSourceMetadataList) DeepCopyObject() runtime.Object {
	out := *in
	in.DeepCopyInto(&out.ListMeta)
	if in.Items != nil {
		out.Items = make([]dataSourceMetadata, len(in.Items))
		for i := range in.Items {
			in.Items[i].DeepCopyInto(&out.Items[i].ObjectMeta)
			out.Items[i].TypeMeta = in.Items[i].TypeMeta
		}
	}
	return &out
}

func newDataSourcesResourceInfo(group string) utils.ResourceInfo {
	return utils.NewResourceInfo(group, datasourceV0.VERSION,
		"datasources", "datasource", dataSourceKind,
		func() runtime.Object { return &dataSourceMetadata{} },
		func() runtime.Object { return &dataSourceMetadataList{} },
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Type", Type: "string", Description: "Plugin type"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]any, error) {
				ds, ok := obj.(*dataSourceMetadata)
				if !ok {
					return nil, errExpectedDataSource
				}
				return []any{
					ds.Name,
					ds.Labels[datasourceV0.LabelKeyGroup],
					ds.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		},
	)
}

func dataSourceMetadataDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	typeMeta := map[string]spec.Schema{
		"kind":       {SchemaProps: spec.SchemaProps{Type: []string{"string"}, Description: "Kind of the object"}},
		"apiVersion": {SchemaProps: spec.SchemaProps{Type: []string{"string"}, Description: "The group and version that serve and write the datasource"}},
	}
	object := dataSourceMetadata{}.OpenAPIModelName()
	list := dataSourceMetadataList{}.OpenAPIModelName()

	item := map[string]spec.Schema{
		"metadata": {SchemaProps: spec.SchemaProps{Default: map[string]any{}, Ref: ref("io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta")}},
	}
	for k, v := range typeMeta {
		item[k] = v
	}
	items := map[string]spec.Schema{
		"metadata": {SchemaProps: spec.SchemaProps{Default: map[string]any{}, Ref: ref("io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta")}},
		"items": {SchemaProps: spec.SchemaProps{
			Type:  []string{"array"},
			Items: &spec.SchemaOrArray{Schema: &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref(object)}}},
		}},
	}
	for k, v := range typeMeta {
		items[k] = v
	}

	return map[string]common.OpenAPIDefinition{
		object: {
			Schema: spec.Schema{SchemaProps: spec.SchemaProps{
				Description: "A datasource without its spec and secure values",
				Type:        []string{"object"},
				Properties:  item,
				Required:    []string{"metadata"},
			}},
			Dependencies: []string{"io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta"},
		},
		list: {
			Schema: spec.Schema{SchemaProps: spec.SchemaProps{
				Type:       []string{"object"},
				Properties: items,
				Required:   []string{"metadata", "items"},
			}},
			Dependencies: []string{object, "io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta"},
		},
	}
}
