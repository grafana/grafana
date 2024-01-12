package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
)

const (
	GROUP      = "query.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var DataSourceResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"datasources", "datasource", "DataSource",
	func() runtime.Object { return &DataSource{} },
	func() runtime.Object { return &DataSourceList{} },
)

var DataSourcePluginResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"plugins", "plugin", "DataSourcePlugin",
	func() runtime.Object { return &DataSourcePlugin{} },
	func() runtime.Object { return &DataSourcePluginList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
