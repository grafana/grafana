package annotation

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Getter               = (*tagsREST)(nil)
	_ rest.Storage              = (*tagsREST)(nil)
	_ rest.Scoper               = (*tagsREST)(nil)
	_ rest.SingularNameProvider = (*tagsREST)(nil)
)

type tagsREST struct {
	store Store
}

type TagList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Tags            []Tag `json:"tags"`
}

func (t *TagList) DeepCopyObject() runtime.Object {
	return t
}

func (r *tagsREST) New() runtime.Object {
	return &TagList{}
}

func (r *tagsREST) Destroy() {}

func (r *tagsREST) NamespaceScoped() bool {
	return true
}

func (r *tagsREST) GetSingularName() string {
	return "tags"
}

func (r *tagsREST) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return &metav1.Table{}, nil
}

func (r *tagsREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)
	
	provider, ok := r.store.(TagProvider)
	if !ok {
		return nil, fmt.Errorf("tag listing not supported")
	}
	
	tags, err := provider.ListTags(ctx, namespace, TagListOptions{Limit: 1000})
	if err != nil {
		return nil, err
	}
	
	return &TagList{
		TypeMeta: metav1.TypeMeta{
			Kind:       "TagList",
			APIVersion: "annotation.grafana.app/v0alpha1",
		},
		Tags: tags,
	}, nil
}
