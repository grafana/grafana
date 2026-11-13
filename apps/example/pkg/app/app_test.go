package app

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resourcebus"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/example/pkg/apis/manifestdata"
)

// simple.NewApp refuses an identity payload under the opinionated reconciler unless the bus is declared to announce
// what it reads, so constructing with a bus in both modes is what holds that declaration to the payload it enables.
func TestNewRunsOnTheBusInBothMetadataModes(t *testing.T) {
	for _, announces := range []bool{false, true} {
		instance, err := New(app.Config{
			KubeConfig:   rest.Config{Host: "http://localhost:3000"},
			ManifestData: *manifestdata.LocalManifest().ManifestData,
			SpecificConfig: &ExampleConfig{
				EnableReconciler:     true,
				ResourceBus:          resourcebus.NewFake(),
				BusAnnouncesMetadata: announces,
			},
		})
		if err != nil {
			t.Fatalf("BusAnnouncesMetadata=%v: %v", announces, err)
		}
		if instance == nil {
			t.Fatalf("BusAnnouncesMetadata=%v: nil app", announces)
		}
	}
}
