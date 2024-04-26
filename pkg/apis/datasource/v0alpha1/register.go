package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP   = "*.datasource.grafana.app"
	VERSION = "v0alpha1"
)

var GenericConnectionResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"connections", "connection", "DataSourceConnection",
	func() runtime.Object { return &DataSourceConnection{} },
	func() runtime.Object { return &DataSourceConnectionList{} },
)
