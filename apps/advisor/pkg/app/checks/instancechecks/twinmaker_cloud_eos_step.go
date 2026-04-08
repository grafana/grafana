package instancechecks

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	twinmakerCloudEOS            = "twinmaker_cloud_eos"
	twinmakerAppPluginID         = "grafana-iot-twinmaker-app"
	twinmakerCloudEOSDate        = "mid-April 2026"
	twinmakerCloudEOSDescription = "The Grafana IoT TwinMaker App will reach end-of-support on Grafana Cloud as of " + twinmakerCloudEOSDate + ". Plan to migrate or remove the app before that date."
)

var _ checks.Step = &twinmakerCloudEOSStep{}

// pluginStore is a minimal interface for checking if a plugin is installed.
// It is satisfied by pluginstore.Store.
type pluginStore interface {
	Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool)
}

type twinmakerCloudEOSStep struct {
	pluginStore pluginStore
}

func (s *twinmakerCloudEOSStep) Title() string {
	return "TwinMaker App Grafana Cloud end-of-support"
}

func (s *twinmakerCloudEOSStep) Description() string {
	return "Warns when Grafana IoT TwinMaker App is installed on Grafana Cloud, as it will reach end-of-support in " + twinmakerCloudEOSDate + "."
}

func (s *twinmakerCloudEOSStep) Resolution() string {
	return twinmakerCloudEOSDescription
}

func (s *twinmakerCloudEOSStep) ID() string {
	return twinmakerCloudEOS
}

func (s *twinmakerCloudEOSStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	item, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	if item != twinmakerCloudEOS {
		return nil, nil
	}

	if s.pluginStore == nil {
		return nil, nil
	}

	_, installed := s.pluginStore.Plugin(ctx, twinmakerAppPluginID)
	if !installed {
		return nil, nil
	}

	return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
		advisor.CheckReportFailureSeverityLow,
		s.ID(),
		"Grafana IoT TwinMaker App is installed and will reach end-of-support on Grafana Cloud in "+twinmakerCloudEOSDate,
		twinmakerCloudEOS,
		[]advisor.CheckErrorLink{},
	)}, nil
}
