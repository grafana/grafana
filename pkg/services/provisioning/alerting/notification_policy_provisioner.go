package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type NotificationPolicyProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
	Unprovision(ctx context.Context, files []*AlertingFile) error
}

type defaultNotificationPolicyProvisioner struct {
	logger                    log.Logger
	notificationPolicyService provisioning.NotificationPolicyService
}

func NewNotificationPolicyProvisoner(logger log.Logger,
	notificationPolicyService provisioning.NotificationPolicyService) NotificationPolicyProvisioner {
	return &defaultNotificationPolicyProvisioner{
		logger:                    logger,
		notificationPolicyService: notificationPolicyService,
	}
}

func (c *defaultNotificationPolicyProvisioner) Provision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, np := range file.Policies {
			err := c.notificationPolicyService.UpdatePolicyTree(ctx, np.OrgID,
				np.Policy, models.ProvenanceFile)
			if err != nil {
				return fmt.Errorf("%s: %w", file.Filename, err)
			}
		}
	}
	return nil
}

func (c *defaultNotificationPolicyProvisioner) Unprovision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, orgID := range file.ResetPolicies {
			_, err := c.notificationPolicyService.ResetPolicyTree(ctx, int64(orgID))
			if err != nil {
				return fmt.Errorf("%s: %w", file.Filename, err)
			}
		}
	}
	return nil
}
