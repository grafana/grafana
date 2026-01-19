package app

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/simple"
	liveV1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
)

func TestHello(t *testing.T) {

	simpleConfig := simple.AppConfig{
		Name: "live",
		// ManagedKinds is the list of all kinds our app manages (the kinds owned by our app).
		// Here, a Kind is defined as a distinct Group, Version, and Kind combination,
		// so for each version of our Example kind, we need to add it to this list.
		// Each kind can also have admission control attached to it--different versions can have different admission control attached.
		// Handlers for custom routes defined in the manifest for the kind go here--this is where they actuall get routed,
		// they are only defined in the manifest.
		// Reconcilers and/or Watchers are also attached here, though they should only be attached to a single version per kind.
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: liveV1.ChannelKind(),
			},
		},
	}

}
