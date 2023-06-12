package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type MuteTimesProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
	Unprovision(ctx context.Context, files []*AlertingFile) error
}

type defaultMuteTimesProvisioner struct {
	logger            log.Logger
	muteTimingService provisioning.MuteTimingService
}

func NewMuteTimesProvisioner(logger log.Logger,
	muteTimingService provisioning.MuteTimingService) MuteTimesProvisioner {
	return &defaultMuteTimesProvisioner{
		logger:            logger,
		muteTimingService: muteTimingService,
	}
}

func (c *defaultMuteTimesProvisioner) Provision(ctx context.Context,
	files []*AlertingFile) error {
	cache := map[int64]map[string]definitions.MuteTimeInterval{}
	for _, file := range files {
		for _, muteTiming := range file.MuteTimes {
			if _, exists := cache[muteTiming.OrgID]; !exists {
				intervals, err := c.muteTimingService.GetMuteTimings(ctx, muteTiming.OrgID)
				if err != nil {
					return err
				}
				cache[muteTiming.OrgID] = make(map[string]definitions.MuteTimeInterval, len(intervals))
				for _, interval := range intervals {
					cache[muteTiming.OrgID][interval.Name] = interval
				}
			}
			muteTiming.MuteTime.Provenance = definitions.Provenance(models.ProvenanceFile)
			if _, exists := cache[muteTiming.OrgID][muteTiming.MuteTime.Name]; exists {
				_, err := c.muteTimingService.UpdateMuteTiming(ctx, muteTiming.MuteTime, muteTiming.OrgID)
				if err != nil {
					return err
				}
				continue
			}
			_, err := c.muteTimingService.CreateMuteTiming(ctx, muteTiming.MuteTime, muteTiming.OrgID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *defaultMuteTimesProvisioner) Unprovision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, deleteMuteTime := range file.DeleteMuteTimes {
			err := c.muteTimingService.DeleteMuteTiming(ctx, deleteMuteTime.Name, deleteMuteTime.OrgID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
