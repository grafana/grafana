package plugincheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

const (
	twinmakerSceneViewerStepID  = "twinmaker_sceneviewer"
	twinmakerAppPluginID        = "grafana-iot-twinmaker-app"
	twinmakerSceneViewerMessage = "The SceneViewer panel in the TwinMaker App will stop working in Grafana 13.1. Ignore or silence this warning if you are not using the SceneViewer panel."
)

var _ checks.Step = &twinmakerSceneViewerStep{}

type twinmakerSceneViewerStep struct{}

func (s *twinmakerSceneViewerStep) Title() string {
	return "TwinMaker SceneViewer deprecation check"
}

func (s *twinmakerSceneViewerStep) Description() string {
	return "Warns when the Grafana IoT TwinMaker App is installed that the SceneViewer panel will stop working in Grafana 13.1."
}

func (s *twinmakerSceneViewerStep) Resolution() string {
	return twinmakerSceneViewerMessage
}

func (s *twinmakerSceneViewerStep) ID() string {
	return twinmakerSceneViewerStepID
}

func (s *twinmakerSceneViewerStep) Run(_ context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
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
		twinmakerSceneViewerStepID,
		[]advisor.CheckErrorLink{
			{
				Message: "View plugin",
				Url:     fmt.Sprintf("/plugins/%s", p.ID),
			},
		},
	)}, nil
}
