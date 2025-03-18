package install

import (
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"

	aggregation "github.com/grafana/grafana/pkg/aggregator/apis/aggregation"
	v0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
)

// Install registers the API group and adds types to a scheme
func Install(scheme *runtime.Scheme) {
	utilruntime.Must(aggregation.AddToScheme(scheme))
	utilruntime.Must(v0alpha1.AddToScheme(scheme))
	utilruntime.Must(scheme.SetVersionPriority(v0alpha1.SchemeGroupVersion))
}
