package plugincheck

import (
	"context"
	"fmt"
	sysruntime "runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	advisor "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
)

type genericStrategy interface {
	rest.RESTCreateStrategy
	rest.RESTUpdateStrategy
}

type plugincheckStorageStrategy struct {
	genericStrategy

	pluginStore pluginstore.Store
	pluginRepo  repo.Service
}

func newStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, pluginStore pluginstore.Store, pluginRepo repo.Service) *plugincheckStorageStrategy {
	genericStrategy := grafanaregistry.NewStrategy(typer, gv)
	return &plugincheckStorageStrategy{genericStrategy, pluginStore, pluginRepo}
}

func (g *plugincheckStorageStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}

	ps := g.pluginStore.Plugins(ctx)

	dsErrs := []advisor.CheckError{}
	for _, p := range ps {
		// Check if plugin is deprecated
		i, err := g.pluginRepo.PluginInfo(ctx, p.ID)
		if err != nil {
			continue
		}
		if i.Status == "deprecated" {
			dsErrs = append(dsErrs, advisor.CheckError{
				Type:   "Investigation recommended",
				Reason: fmt.Sprintf("Plugin deprecated: %s", p.ID),
				Action: "Look for alternatives",
			})
		}

		// Check if plugin has a newer version
		info, err := g.pluginRepo.GetPluginArchiveInfo(ctx, p.ID, "", repo.NewCompatOpts("", sysruntime.GOOS, sysruntime.GOARCH))
		if err != nil {
			continue
		}
		if info.Version != p.Info.Version { // TODO: Improve check for newer version
			dsErrs = append(dsErrs, advisor.CheckError{
				Type:   "Action recommended",
				Reason: fmt.Sprintf("Newer version available: %s", p.ID),
				Action: "Update plugin",
			})
		}
	}

	err = meta.SetStatus(advisor.PluginCheckStatus{
		Errors: dsErrs,
		Count:  len(ps),
	})
	if err != nil {
		return
	}
}

// Validate ensures that when creating a userstorage object, the name matches the user id.
func (g *plugincheckStorageStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

func (g *plugincheckStorageStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}
