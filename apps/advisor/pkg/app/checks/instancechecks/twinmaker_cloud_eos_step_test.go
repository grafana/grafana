package instancechecks

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type twinmakerTestPluginStore struct {
	twinmakerInstalled bool
}

func (s *twinmakerTestPluginStore) Plugin(_ context.Context, pluginID string) (pluginstore.Plugin, bool) {
	if pluginID == twinmakerAppPluginID && s != nil && s.twinmakerInstalled {
		return pluginstore.Plugin{}, true
	}
	return pluginstore.Plugin{}, false
}

func TestTwinmakerCloudEOSStep_Run(t *testing.T) {
	log := logging.DefaultLogger

	tests := []struct {
		name              string
		pluginStore       *twinmakerTestPluginStore
		input             any
		wantFailures       bool
		wantFailureMessage string
		wantErr            bool
	}{
		{
			name:        "wrong item type returns error",
			pluginStore: &twinmakerTestPluginStore{},
			input:       123,
			wantErr:     true,
		},
		{
			name:        "other item returns no failure",
			pluginStore: &twinmakerTestPluginStore{twinmakerInstalled: true},
			input:       pinnedVersion,
			wantErr:     false,
			wantFailures: false,
		},
		{
			name:        "TwinMaker not installed returns no failure",
			pluginStore: &twinmakerTestPluginStore{twinmakerInstalled: false},
			input:       twinmakerCloudEOS,
			wantErr:     false,
			wantFailures: false,
		},
		{
			name:        "TwinMaker installed returns warning failure",
			pluginStore: &twinmakerTestPluginStore{twinmakerInstalled: true},
			input:       twinmakerCloudEOS,
			wantErr:     false,
			wantFailures: true,
			wantFailureMessage: "end-of-support on Grafana Cloud",
		},
		{
			name:        "nil plugin store returns no failure",
			pluginStore: nil, // step with nil store
			input:       twinmakerCloudEOS,
			wantErr:     false,
			wantFailures: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var store pluginStore
			if tt.pluginStore != nil {
				store = tt.pluginStore
			}
			step := &twinmakerCloudEOSStep{pluginStore: store}

			failures, err := step.Run(context.Background(), log, &advisor.CheckSpec{}, tt.input)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tt.wantFailures {
				require.Len(t, failures, 1)
				assert.Equal(t, advisor.CheckReportFailureSeverityLow, failures[0].Severity)
				assert.Contains(t, failures[0].Item, tt.wantFailureMessage)
			} else {
				assert.Len(t, failures, 0)
			}
		})
	}
}
