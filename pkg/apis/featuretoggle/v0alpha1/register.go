package v0alpha1

import (
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "featuretoggle.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

// FeatureResourceInfo represents each feature that may have a toggle
var FeatureResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"features", "feature", "Feature",
	func() runtime.Object { return &Feature{} },
	func() runtime.Object { return &FeatureList{} },
)

// TogglesResourceInfo represents the actual configuration
var TogglesResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"featuretoggles", "featuretoggle", "FeatureToggles",
	func() runtime.Object { return &FeatureToggles{} },
	func() runtime.Object { return &FeatureTogglesList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
