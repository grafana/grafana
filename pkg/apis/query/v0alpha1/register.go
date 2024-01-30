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

var DataSourceAPIResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"datasourceapis", "datasourceapi", "DataSourceAPI",
	func() runtime.Object { return &DataSourceAPI{} },
	func() runtime.Object { return &DataSourceAPIList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
