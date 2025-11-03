package alerting

import (
	"context"
	"errors"
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
			if _, err := c.notificationPolicyService.GetManagedRoute(ctx, np.OrgID, np.Name); err != nil {
				if errors.Is(err, provisioning.ErrRouteNotFound) {
					_, err := c.notificationPolicyService.CreateManagedRoute(ctx, np.OrgID, np.Name,
						np.Policy, models.ProvenanceFile)
					if err != nil {
						return fmt.Errorf("%s: %w", file.Filename, err)
					}
					continue
				}
				return err
			}
			_, err := c.notificationPolicyService.UpdateManagedRoute(ctx, np.OrgID, np.Name,
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
			err := c.notificationPolicyService.DeleteManagedRoute(ctx, deletePolicy.OrgID, deletePolicy.Name, models.ProvenanceFile, "")
			if err != nil {
				return fmt.Errorf("%s: %w", file.Filename, err)
			}
		}
	}
	return nil
}
