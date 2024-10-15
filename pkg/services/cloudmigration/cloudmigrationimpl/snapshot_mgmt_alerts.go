package cloudmigrationimpl

import (
	"context"
	"fmt"

	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

type muteTimeInterval struct {
	// There is a lot of custom (de)serialization logic from Alertmanager,
	// and this is the same type used by the underlying API, hence we can use the type as-is.
	config.MuteTimeInterval `json:",inline"`
}

func (s *Service) getAlertMuteTimings(ctx context.Context, signedInUser *user.SignedInUser) ([]muteTimeInterval, error) {
	if !s.features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrationsAlerts) {
		return nil, nil
	}

	muteTimings, err := s.ngAlert.Api.MuteTimings.GetMuteTimings(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching ngalert mute timings: %w", err)
	}

	muteTimeIntervals := make([]muteTimeInterval, 0, len(muteTimings))

	for _, muteTiming := range muteTimings {
		muteTimeIntervals = append(muteTimeIntervals, muteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name:          muteTiming.Name,
				TimeIntervals: muteTiming.TimeIntervals,
			},
		})
	}

	return muteTimeIntervals, nil
}

type notificationTemplate struct {
	Name     string `json:"name"`
	Template string `json:"template"`
}

func (s *Service) getNotificationTemplates(ctx context.Context, signedInUser *user.SignedInUser) ([]notificationTemplate, error) {
	if !s.features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrationsAlerts) {
		return nil, nil
	}

	templates, err := s.ngAlert.Api.Templates.GetTemplates(ctx, signedInUser.OrgID)
	if err != nil {
		return nil, fmt.Errorf("fetching ngalert notification templates: %w", err)
	}

	notificationTemplates := make([]notificationTemplate, 0, len(templates))

	for _, template := range templates {
		notificationTemplates = append(notificationTemplates, notificationTemplate{
			Name:     template.Name,
			Template: template.Template,
		})
	}

	return notificationTemplates, nil
}
