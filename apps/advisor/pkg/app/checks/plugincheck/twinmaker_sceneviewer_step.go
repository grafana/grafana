package plugincheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

const (
	twinmakerSceneViewerStepID = "twinmaker_sceneviewer"
	twinmakerAppPluginID       = "grafana-iot-twinmaker-app"
	// twinmakerDeprecationVersion is the single source of truth for the
	// Grafana version in which SceneViewer stops working. Referenced by the
	// step Description/Resolution templates via {{version}}.
	twinmakerDeprecationVersion = "13.1"
)

var _ checks.Step = &twinmakerSceneViewerStep{}

type twinmakerSceneViewerStep struct{}

func (s *twinmakerSceneViewerStep) Title() string {
	return "TwinMaker SceneViewer deprecation check"
}

func (s *twinmakerSceneViewerStep) Description() string {
	return "Warns when the Grafana IoT TwinMaker App is installed that the SceneViewer panel will stop working in Grafana {{version}}."
}

func (s *twinmakerSceneViewerStep) DescriptionArgs() map[string]string {
	return map[string]string{"version": twinmakerDeprecationVersion}
}

func (s *twinmakerSceneViewerStep) Resolution() string {
	return "The SceneViewer panel in the TwinMaker App will stop working in Grafana {{version}}. " +
		"Ignore or silence this warning if you are not using the SceneViewer panel."
}

func (s *twinmakerSceneViewerStep) ResolutionArgs() map[string]string {
	return map[string]string{"version": twinmakerDeprecationVersion}
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
		checks.RenderResolution(s),
		twinmakerSceneViewerStepID,
		[]advisor.CheckErrorLink{
			{
				Message: "View plugin",
				Url:     fmt.Sprintf("/plugins/%s", p.ID),
			},
		},
	)}, nil
}
