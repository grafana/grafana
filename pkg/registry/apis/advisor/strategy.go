package advisor

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/models"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

type genericStrategy interface {
	rest.RESTCreateStrategy
	rest.RESTUpdateStrategy
}

type datasourceCheckStrategy struct {
	genericStrategy

	c models.Check
}

func newStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, c models.Check) *datasourceCheckStrategy {
	genericStrategy := grafanaregistry.NewStrategy(typer, gv)
	return &datasourceCheckStrategy{genericStrategy, c}
}

func (g *datasourceCheckStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	// Run the check
	dsErrs, err := g.c.Run(ctx, obj)
	if err != nil {
		// TODO: Handle error
		return
	}

	// Store result in the status
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		// TODO: Errors may need to be at least logged
		return
	}
	err = meta.SetStatus(*dsErrs)
	if err != nil {
		return
	}
}
