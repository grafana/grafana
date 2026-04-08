package plugincheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

const (
	twinmakerCloudEOSStepID     = "twinmaker_cloud_eos"
	twinmakerAppPluginID        = "grafana-iot-twinmaker-app"
	twinmakerSceneViewerMessage = "The SceneViewer panel in the TwinMaker App will be a breaking change in Grafana v13. It will continue to work as expected for all Grafana deployments before version 13.1."
)

var _ checks.Step = &twinmakerCloudEOSStep{}

type twinmakerCloudEOSStep struct{}

func (s *twinmakerCloudEOSStep) Title() string {
	return "TwinMaker SceneViewer and Grafana v13"
}

func (s *twinmakerCloudEOSStep) Description() string {
	return "Warns when the Grafana IoT TwinMaker App is installed about the SceneViewer panel breaking change in Grafana v13."
}

func (s *twinmakerCloudEOSStep) Resolution() string {
	return twinmakerSceneViewerMessage
}

func (s *twinmakerCloudEOSStep) ID() string {
	return twinmakerCloudEOSStepID
}

func (s *twinmakerCloudEOSStep) Run(_ context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	pi, ok := it.(*pluginItem)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	p := pi.Plugin
	if p == nil || p.ID != twinmakerAppPluginID {
		return nil, nil
	}

	return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
		advisor.CheckReportFailureSeverityLow,
		s.ID(),
		twinmakerSceneViewerMessage,
		twinmakerCloudEOSStepID,
		[]advisor.CheckErrorLink{},
	)}, nil
}
