package sql

import (
	"fmt"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

// QOSConfig contains the configuration for initializing QOS.
type QOSConfig struct {
	Cfg *setting.Cfg
	Log log.Logger
	Reg prometheus.Registerer
}

// QOSState holds the QOS queue and scheduler state.
type QOSState struct {
	Queue     QOSEnqueueDequeuer
	Scheduler *scheduler.Scheduler
}

// InitQOS initializes the QOS queue and scheduler if enabled.
// Returns nil state if QOS is not enabled in the configuration.
// The returned services should be added to the subservices manager.
func InitQOS(cfg QOSConfig) (*QOSState, []services.Service, error) {
	if !cfg.Cfg.QOSEnabled {
		return nil, nil, nil
	}

	qosReg := prometheus.WrapRegistererWithPrefix("resource_server_qos_", cfg.Reg)
	queue := scheduler.NewQueue(&scheduler.QueueOptions{
		MaxSizePerTenant: cfg.Cfg.QOSMaxSizePerTenant,
		Registerer:       qosReg,
	})
	sched, err := scheduler.NewScheduler(queue, &scheduler.Config{
		NumWorkers: cfg.Cfg.QOSNumberWorker,
		Logger:     cfg.Log,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create qos scheduler: %w", err)
	}

	state := &QOSState{
		Queue:     queue,
		Scheduler: sched,
	}

	subservices := []services.Service{queue, sched}

	return state, subservices, nil
}
