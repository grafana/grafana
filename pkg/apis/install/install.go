package install

import (
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"

	playlistv1 "github.com/grafana/grafana/pkg/apis/playlist/v1"
)

// Install registers the API group and adds types to a scheme
func Install(scheme *runtime.Scheme) {
	utilruntime.Must(playlistv1.AddToScheme(scheme))
	utilruntime.Must(scheme.SetVersionPriority(playlistv1.SchemeGroupVersion))
}
