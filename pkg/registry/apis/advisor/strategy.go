package advisor

import (
	"context"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/models"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
)

type genericStrategy interface {
	rest.RESTCreateStrategy
	rest.RESTUpdateStrategy
}

type datasourceCheckStrategy struct {
	genericStrategy

	c          models.Check
	updateChan chan<- updateReq
}

func newStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, c models.Check, updateChan chan<- updateReq) *datasourceCheckStrategy {
	genericStrategy := grafanaregistry.NewStrategy(typer, gv)
	return &datasourceCheckStrategy{genericStrategy, c, updateChan}
}

func (g *datasourceCheckStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	// Send the update signal
	go func() {
		g.updateChan <- updateReq{ctx, obj}
	}()

	return nil
}
