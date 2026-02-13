package fakes

import (
	"context"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
)

type FakePluginSettingsProvider struct {
	Settings aggregationv0alpha1.PluginSettingDTO
	Err      error
}

func (f FakePluginSettingsProvider) GetPluginSettings(ctx context.Context, pluginID, namespace string) (aggregationv0alpha1.PluginSettingDTO, error) {
	return f.Settings, f.Err
}
