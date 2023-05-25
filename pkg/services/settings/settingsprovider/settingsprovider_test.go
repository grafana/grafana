package settingsprovider

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestImplementation_Current(t *testing.T) {
	tests := []struct {
		name     string
		settings setting.SettingsBag
		want     setting.SettingsBag
	}{
		{
			"empty bag",
			setting.SettingsBag{},
			setting.SettingsBag{},
		},
		{
			"one unredacted item",
			setting.SettingsBag{"section": {"username": "mario"}},
			setting.SettingsBag{"section": {"username": "mario"}},
		},
		{
			"one redacted item",
			setting.SettingsBag{"section": {"password": "itsame"}},
			setting.SettingsBag{"section": {"password": setting.RedactedPassword}},
		},
		{
			"one redacted and one unredacted item",
			setting.SettingsBag{"section": {"username": "mario", "password": "itsame"}},
			setting.SettingsBag{"section": {"username": "mario", "password": setting.RedactedPassword}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			i := &Implementation{settings: tc.settings}
			b := i.Current()
			require.EqualValues(t, tc.want, b)
		})
	}
}

func TestImplementation_IsFeatureToggleEnabled(t *testing.T) {
	i := Implementation{
		FileCfg:  &setting.Cfg{},
		features: featuremgmt.WithFeatures("ngalert", "encryption"),
	}

	assert.True(t, i.IsFeatureToggleEnabled("encryption"))
	assert.True(t, i.IsFeatureToggleEnabled("ngalert"))
	assert.False(t, i.IsFeatureToggleEnabled("somefeature"))
}
