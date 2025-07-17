package alerting

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
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
			if _, _, err := c.notificationPolicyService.GetPolicySubTree(ctx, np.OrgID, np.Policy.Name); err != nil {
				if errors.Is(err, legacy_storage.ErrRouteNotFound) {
					_, _, err := c.notificationPolicyService.CreatePolicySubTree(ctx, np.OrgID,
						np.Policy, models.ProvenanceFile)
					if err != nil {
						return fmt.Errorf("%s: %w", file.Filename, err)
					}
					continue
				}
				return err
			}
			_, _, err := c.notificationPolicyService.UpdatePolicySubTree(ctx, np.OrgID,
				np.Policy, models.ProvenanceFile, "")
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
		for _, deletePolicy := range file.DeletePolicies {
			err := c.notificationPolicyService.DeletePolicySubTree(ctx, deletePolicy.OrgID, deletePolicy.Name, models.ProvenanceFile, "")
			if err != nil {
				return fmt.Errorf("%s: %w", file.Filename, err)
			}
		}
	}
	return nil
}
