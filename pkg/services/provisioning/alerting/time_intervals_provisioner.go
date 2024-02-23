package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type TimeIntervalsProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
	Unprovision(ctx context.Context, files []*AlertingFile) error
}

type defaultTimeIntervalsProvisioner struct {
	logger  log.Logger
	service provisioning.TimeIntervalService
}

func NewTimeIntervalsProvisioner(l log.Logger, s provisioning.TimeIntervalService) TimeIntervalsProvisioner {
	return &defaultTimeIntervalsProvisioner{
		logger:  l,
		service: s,
	}
}

func (c *defaultTimeIntervalsProvisioner) Provision(ctx context.Context, files []*AlertingFile) error {
	cache := map[int64]map[string]definitions.TimeInterval{}
	for _, file := range files {
		for _, ti := range file.TimeIntervals {
			if _, exists := cache[ti.OrgID]; !exists {
				intervals, err := c.service.GetTimeIntervals(ctx, ti.OrgID)
				if err != nil {
					return err
				}
				cache[ti.OrgID] = make(map[string]definitions.TimeInterval, len(intervals))
				for _, interval := range intervals {
					cache[ti.OrgID][interval.Name] = interval
				}
			}
			ti.TimeInterval.Provenance = definitions.Provenance(models.ProvenanceFile)
			if _, exists := cache[ti.OrgID][ti.TimeInterval.Name]; exists {
				_, err := c.service.UpdateTimeInterval(ctx, ti.TimeInterval, ti.OrgID)
				if err != nil {
					return err
				}
				continue
			}
			_, err := c.service.CreateTimeInterval(ctx, ti.TimeInterval, ti.OrgID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (c *defaultTimeIntervalsProvisioner) Unprovision(ctx context.Context, files []*AlertingFile) error {
	for _, file := range files {
		for _, ti := range file.DeleteTimeIntervals {
			err := c.service.DeleteTimeInterval(ctx, ti.Name, ti.OrgID)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
