package template

import (
	"context"
	"fmt"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	notificationsModels "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

func NewTemplateConnect(templateGroupGetter rest.Getter) rest.Storage {
	return &templateGroupTemplateConnect{
		getter: templateGroupGetter,
	}
}

type templateGroupTemplateConnect struct {
	getter rest.Getter
}

var _ = rest.Connecter(&templateGroupTemplateConnect{})

func (r *templateGroupTemplateConnect) New() runtime.Object {
	return &notificationsModels.Template{}
}

func (r *templateGroupTemplateConnect) Destroy() {
}

func (r *templateGroupTemplateConnect) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *templateGroupTemplateConnect) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *templateGroupTemplateConnect) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	templateGroup, ok := obj.(*notificationsModels.TemplateGroup)
	if !ok {
		return nil, fmt.Errorf("expected template group but got %T", obj)
	}

	templates, err := notifier.ParseTemplateGroup(templateGroup.Spec.Content)
	if err != nil {
		return nil, err
	}

	result := make([]notificationsModels.Template, 0, len(templates))
	for _, t := range templates {
		result = append(result, notificationsModels.Template{
			TypeMeta: notificationsModels.TemplateResourceInfo.TypeMeta(),
			Name:     t.Name(),
			Content:  t.Tree.Root.String(),
		})
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, &notificationsModels.TemplateList{
			TypeMeta: notificationsModels.TemplateResourceInfo.TypeMeta(),
			Items:    result,
		})
	}), nil
}
