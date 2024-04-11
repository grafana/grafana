package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "example.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var RuntimeResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"runtime", "runtime", "RuntimeInfo",
	func() runtime.Object { return &RuntimeInfo{} },
	func() runtime.Object { return &RuntimeInfo{} },
)
var DummyResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"dummy", "dummy", "DummyResource",
	func() runtime.Object { return &DummyResource{} },
	func() runtime.Object { return &DummyResourceList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
