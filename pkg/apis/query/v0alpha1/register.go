package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/definition"
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
	"querytypedefinitions", "querytypedefinition", "QueryTypeDefinition",
	func() runtime.Object { return &definition.QueryTypeDefinition{} },
	func() runtime.Object { return &definition.QueryTypeDefinitionList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
