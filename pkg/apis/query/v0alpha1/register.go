package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apis"
)

const (
	GROUP      = "query.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

// Mainly here so there is a resource (otherwise k8s is not happy)
var ExpressionResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"expressions", "expression", "ExpressionInfo",
	func() runtime.Object { return &ExpressionInfo{} },
	func() runtime.Object { return &ExpressionInfoList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
