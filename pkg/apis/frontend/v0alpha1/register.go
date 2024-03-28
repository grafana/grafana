package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
)

const (
	GROUP      = "frontend.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ExtensionResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"extensions", "extension", "ExtensionResource",
	func() runtime.Object { return &ExtensionResource{} },
	func() runtime.Object { return &ExtensionResourceList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
