package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "query.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var DataSourceApiServerResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"datasourceapiservers", "datasourceapiserver", "DataSourceApiServer",
	func() runtime.Object { return &DataSourceApiServer{} },
	func() runtime.Object { return &DataSourceApiServerList{} },
)

var QueryTypeDefinitionResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"querytypes", "querytype", "QueryTypeDefinition",
	func() runtime.Object { return &QueryTypeDefinition{} },
	func() runtime.Object { return &QueryTypeDefinitionList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
