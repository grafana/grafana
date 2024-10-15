package cloudmigrationimpl

import (
	"context"
	"fmt"

	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
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

type contactPoint struct {
	Settings              *simplejson.Json `json:"settings"`
	UID                   string           `json:"uid"`
	Name                  string           `json:"name"`
	Type                  string           `json:"type"`
	DisableResolveMessage bool             `json:"disableResolveMessage"`
}

func (s *Service) getContactPoints(ctx context.Context, signedInUser *user.SignedInUser) ([]contactPoint, error) {
	if !s.features.IsEnabledGlobally(featuremgmt.FlagOnPremToCloudMigrationsAlerts) {
		return nil, nil
	}

	query := provisioning.ContactPointQuery{
		OrgID:   signedInUser.GetOrgID(),
		Decrypt: true, // needed to recreate the settings in the target instance.
	}

	embeddedContactPoints, err := s.ngAlert.Api.ContactPointService.GetContactPoints(ctx, query, signedInUser)
	if err != nil {
		return nil, fmt.Errorf("fetching ngalert contact points: %w", err)
	}

	contactPoints := make([]contactPoint, 0, len(embeddedContactPoints))

	for _, embeddedContactPoint := range embeddedContactPoints {
		contactPoints = append(contactPoints, contactPoint{
			UID:                   embeddedContactPoint.UID,
			Name:                  embeddedContactPoint.Name,
			Type:                  embeddedContactPoint.Type,
			Settings:              embeddedContactPoint.Settings,
			DisableResolveMessage: embeddedContactPoint.DisableResolveMessage,
		})
	}

	return contactPoints, nil
}
