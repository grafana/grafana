package plugincheck

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTwinmakerSceneViewerStep_Run(t *testing.T) {
	log := logging.DefaultLogger

	otherPlugin := &pluginstore.Plugin{
		JSONData: plugins.JSONData{ID: "some-other-plugin", Name: "Other"},
	}
	twinmakerPlugin := &pluginstore.Plugin{
		JSONData: plugins.JSONData{ID: twinmakerAppPluginID, Name: "TwinMaker"},
	}

	tests := []struct {
		name               string
		input              any
		wantFailures       bool
		wantFailureMessage string
		wantErr            bool
	}{
		{
			name:    "wrong item type returns error",
			input:   123,
			wantErr: true,
		},
		{
			name:         "other plugin returns no failure",
			input:        &pluginItem{Plugin: otherPlugin},
			wantErr:      false,
			wantFailures: false,
		},
		{
			name:               "TwinMaker installed returns warning failure",
			input:              &pluginItem{Plugin: twinmakerPlugin},
			wantErr:            false,
			wantFailures:       true,
			wantFailureMessage: "SceneViewer panel",
		},
		{
			name:         "nil plugin item returns no failure",
			input:        &pluginItem{Plugin: nil},
			wantErr:      false,
			wantFailures: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			step := &twinmakerSceneViewerStep{}

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
				assert.Equal(t, []advisor.CheckErrorLink{
					{Message: "View plugin", Url: "/plugins/" + twinmakerAppPluginID},
				}, failures[0].Links)
			} else {
				assert.Len(t, failures, 0)
			}
		})
	}
}
