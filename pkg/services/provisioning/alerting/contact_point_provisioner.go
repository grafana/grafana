package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type ContactPointProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
	Unprovision(ctx context.Context, files []*AlertingFile) error
}

type defaultContactPointProvisioner struct {
	logger              log.Logger
	contactPointService provisioning.ContactPointService
}

func NewContactPointProvisoner(logger log.Logger,
	contactPointService provisioning.ContactPointService) ContactPointProvisioner {
	return &defaultContactPointProvisioner{
		logger:              logger,
		contactPointService: contactPointService,
	}
}

func (c *defaultContactPointProvisioner) Provision(ctx context.Context,
	files []*AlertingFile) error {
	cpsCache := map[int64][]definitions.EmbeddedContactPoint{}
	for _, file := range files {
		for _, contactPointsConfig := range file.ContactPoints {
			// check if we already fetched the contact points for this org.
			// if not we fetch them and populate the cache.
			if _, exists := cpsCache[contactPointsConfig.OrgID]; !exists {
				cps, err := c.contactPointService.GetContactPoints(ctx, provisioning.ContactPointQuery{
					OrgID: contactPointsConfig.OrgID,
				})
				if err != nil {
					return err
				}
				cpsCache[contactPointsConfig.OrgID] = cps
			}
		outer:
			for _, contactPoint := range contactPointsConfig.ContactPoints {
				for _, fetchedCP := range cpsCache[contactPointsConfig.OrgID] {
					if fetchedCP.UID == contactPoint.UID {
						err := c.contactPointService.UpdateContactPoint(ctx,
							contactPointsConfig.OrgID, contactPoint, models.ProvenanceFile)
						if err != nil {
							return err
						}
						continue outer
					}
				}
				_, err := c.contactPointService.CreateContactPoint(ctx, contactPointsConfig.OrgID,
					contactPoint, models.ProvenanceFile)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (c *defaultContactPointProvisioner) Unprovision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, cp := range file.DeleteContactPoints {
			err := c.contactPointService.DeleteContactPoint(ctx, cp.OrgID, cp.UID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
