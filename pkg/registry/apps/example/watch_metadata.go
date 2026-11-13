package example

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	examplev1alpha1 "github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
	exampleapp "github.com/grafana/grafana/apps/example/pkg/app"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Storage announces these with every example watch notification, which is what lets the app's reconciler run on an
// identity payload: the opinionated wrapper reads the finalizers, and the deletion timestamp and generation ride
// along with any registered spec. Registering in init links it into every target, including storage-server.
func init() {
	resource.RegisterWatchMetadata(
		schema.GroupResource{Group: examplev1alpha1.APIGroup, Resource: "examples"},
		resource.WatchMetadataSpec{Finalizers: exampleapp.AnnouncedFinalizers},
	)
}
