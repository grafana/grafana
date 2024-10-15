package cloudmigrationimpl

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestGetAlertMuteTimings(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is not enabled it returns nil", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations)

		muteTimeIntervals, err := s.getAlertMuteTimings(ctx, nil)
		require.NoError(t, err)
		require.Nil(t, muteTimeIntervals)
	})

	t.Run("when the feature flag `onPremToCloudMigrationsAlerts` is enabled it returns the mute timings", func(t *testing.T) {
		s := setUpServiceTest(t, false).(*Service)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations, featuremgmt.FlagOnPremToCloudMigrationsAlerts)

		var orgID int64 = 1
		user := &user.SignedInUser{OrgID: orgID}

		createdMuteTiming := createMuteTiming(t, ctx, s, orgID)

		muteTimeIntervals, err := s.getAlertMuteTimings(ctx, user)
		require.NoError(t, err)
		require.NotNil(t, muteTimeIntervals)
		require.Len(t, muteTimeIntervals, 1)
		require.Equal(t, createdMuteTiming.Name, muteTimeIntervals[0].Name)
	})
}

func createMuteTiming(t *testing.T, ctx context.Context, service *Service, orgID int64) definitions.MuteTimeInterval {
	t.Helper()

	muteTiming := `{
		"name": "My Unique MuteTiming 1",
		"time_intervals": [
			{
				"times": [{"start_time": "12:12","end_time": "23:23"}],
				"weekdays": ["monday","wednesday","friday","sunday"],
				"days_of_month": ["10:20","25:-1"],
				"months": ["1:6","10:12"],
				"years": ["2022:2054"],
				"location": "Africa/Douala"
			}
		]
	}`

	var mt definitions.MuteTimeInterval
	require.NoError(t, json.Unmarshal([]byte(muteTiming), &mt))

	createdTiming, err := service.ngAlert.Api.MuteTimings.CreateMuteTiming(ctx, mt, orgID)
	require.NoError(t, err)

	return createdTiming
}
