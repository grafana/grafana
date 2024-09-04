package v0alpha1

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "featuretoggle.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

// FeatureResourceInfo represents each feature that may have a toggle
var FeatureResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"features", "feature", "Feature",
	func() runtime.Object { return &Feature{} },
	func() runtime.Object { return &FeatureList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Stage", Type: "string", Format: "string", Description: "Where is the flag in the dev cycle"},
			{Name: "Owner", Type: "string", Format: "string", Description: "Which team owns the feature"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*Feature)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Stage,
					r.Spec.Owner,
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		},
	},
)

// TogglesResourceInfo represents the actual configuration
var TogglesResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"featuretoggles", "featuretoggle", "FeatureToggles",
	func() runtime.Object { return &FeatureToggles{} },
	func() runtime.Object { return &FeatureTogglesList{} },
	utils.TableColumns{}, // default table converter
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
