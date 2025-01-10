package models

import (
	"context"

	advisorv0alpha1 "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"k8s.io/apimachinery/pkg/runtime"
)

type AdvisorAPIServices struct {
	DatasourceSvc         datasources.DataSourceService
	PluginRepo            repo.Service
	PluginStore           pluginstore.Store
	PluginContextProvider *plugincontext.Provider
	PluginClient          plugins.Client
}

type Check interface {
	Run(ctx context.Context, obj runtime.Object) (*advisorv0alpha1.CheckStatus, error)
	Object() runtime.Object
	ObjectList() runtime.Object
	Name() string
	Kind() string
}
