package sql

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	// Validation errors.
	errHistoryPollRequired    = fmt.Errorf("historyPoll is required")
	errListLatestRVsRequired  = fmt.Errorf("listLatestRVs is required")
	errBulkLockRequired       = fmt.Errorf("bulkLock is required")
	errTracerRequired         = fmt.Errorf("tracer is required")
	errLogRequired            = fmt.Errorf("log is required")
	errInvalidWatchBufferSize = fmt.Errorf("watchBufferSize must be greater than 0")
	errInvalidPollingInterval = fmt.Errorf("pollingInterval must be greater than 0")
	errDoneRequired           = fmt.Errorf("done is required")
	errDialectRequired        = fmt.Errorf("dialect is required")
)

// pollingNotifier is a notifier that polls the database for new events.
type pollingNotifier struct {
	dialect         sqltemplate.Dialect
	pollingInterval time.Duration
	watchBufferSize int

	log            logging.Logger
	tracer         trace.Tracer
	storageMetrics *resource.StorageMetrics

	bulkLock      *bulkLock
	listLatestRVs func(ctx context.Context) (groupResourceRV, error)
	historyPoll   func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error)

	done <-chan struct{}
}

type pollingNotifierConfig struct {
	dialect         sqltemplate.Dialect
	pollingInterval time.Duration
	watchBufferSize int

	log            logging.Logger
	tracer         trace.Tracer
	storageMetrics *resource.StorageMetrics

	bulkLock      *bulkLock
	listLatestRVs func(ctx context.Context) (groupResourceRV, error)
	historyPoll   func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error)

	done <-chan struct{}
}

func (cfg *pollingNotifierConfig) validate() error {
	if cfg.historyPoll == nil {
		return errHistoryPollRequired
	}
	if cfg.listLatestRVs == nil {
		return errListLatestRVsRequired
	}
	if cfg.bulkLock == nil {
		return errBulkLockRequired
	}
	if cfg.tracer == nil {
		return errTracerRequired
	}
	if cfg.log == nil {
		return errLogRequired
	}
	if cfg.watchBufferSize <= 0 {
		return errInvalidWatchBufferSize
	}
	if cfg.pollingInterval <= 0 {
		return errInvalidPollingInterval
	}
	if cfg.done == nil {
		return errDoneRequired
	}
	if cfg.dialect == nil {
		return errDialectRequired
	}
	return nil
}

func newPollingNotifier(cfg *pollingNotifierConfig) (*pollingNotifier, error) {
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("invalid polling notifier config: %w", err)
	}
	return &pollingNotifier{
		dialect:         cfg.dialect,
		pollingInterval: cfg.pollingInterval,
		watchBufferSize: cfg.watchBufferSize,
		log:             cfg.log,
		tracer:          cfg.tracer,
		bulkLock:        cfg.bulkLock,
		listLatestRVs:   cfg.listLatestRVs,
		historyPoll:     cfg.historyPoll,
		done:            cfg.done,
		storageMetrics:  cfg.storageMetrics,
	}, nil
}

func (p *pollingNotifier) notify(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	since, err := p.listLatestRVs(ctx)
	if err != nil {
		return nil, fmt.Errorf("watch, get latest resource version: %w", err)
	}
	stream := make(chan *resource.WrittenEvent, p.watchBufferSize)
	go p.poller(ctx, since, stream)
	return stream, nil
}

func (p *pollingNotifier) poller(ctx context.Context, since groupResourceRV, stream chan<- *resource.WrittenEvent) {
	t := time.NewTicker(p.pollingInterval)
	defer close(stream)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-p.done:
			return
		case <-t.C:
			ctx, span := p.tracer.Start(ctx, tracePrefix+"poller")
			// List the latest RVs to see if any of those are not have been seen before.
			grv, err := p.listLatestRVs(ctx)
			if err != nil {
				p.log.Error("poller get latest resource version", "err", err)
				t.Reset(p.pollingInterval)
				continue
			}
			for group, items := range grv {
				for resource, latestRV := range items {
					// If we haven't seen this resource before, we start from 0.
					if _, ok := since[group]; !ok {
						since[group] = make(map[string]int64)
					}
					if _, ok := since[group][resource]; !ok {
						since[group][resource] = 0
					}

					// We don't need to poll if the RV hasn't changed.
					if since[group][resource] >= latestRV {
						p.log.Debug("polling for resource skipped",
							"group", group,
							"resource", resource,
							"latestKnownRV", since[group][resource],
							"latestFetchedRV", latestRV)
						continue
					}

					// Poll for new events since the last known RV.
					next, err := p.poll(ctx, group, resource, since[group][resource], stream)
					if err != nil {
						p.log.Error("polling for resource", "err", err)
						t.Reset(p.pollingInterval)
						continue
					}
					if next > since[group][resource] {
						since[group][resource] = next
					}
				}
			}

			t.Reset(p.pollingInterval)
			span.End()
		}
	}
}

func (p *pollingNotifier) poll(ctx context.Context, grp string, res string, since int64, stream chan<- *resource.WrittenEvent) (int64, error) {
	ctx, span := p.tracer.Start(ctx, tracePrefix+"poll")
	defer span.End()

	start := time.Now()
	records, err := p.historyPoll(ctx, grp, res, since)
	if err != nil {
		return 0, fmt.Errorf("poll history: %w", err)
	}
	if p.storageMetrics != nil {
		p.storageMetrics.PollerLatency.Observe(time.Since(start).Seconds())
	}

	var nextRV int64
	for _, rec := range records {
		if rec.Key.Group == "" || rec.Key.Resource == "" || rec.Key.Name == "" {
			return nextRV, fmt.Errorf("missing key in response")
		}
		nextRV = rec.ResourceVersion
		prevRV := rec.PreviousRV
		if prevRV == nil {
			prevRV = new(int64)
		}
		stream <- &resource.WrittenEvent{
			Value: rec.Value,
			Key: &resource.ResourceKey{
				Namespace: rec.Key.Namespace,
				Group:     rec.Key.Group,
				Resource:  rec.Key.Resource,
				Name:      rec.Key.Name,
			},
			Type:            resource.WatchEvent_Type(rec.Action),
			PreviousRV:      *prevRV,
			Folder:          rec.Folder,
			ResourceVersion: rec.ResourceVersion,
			// Timestamp:  , // TODO: add timestamp
		}
		p.log.Debug("poller sent event to stream",
			"namespace", rec.Key.Namespace,
			"group", rec.Key.Group,
			"resource", rec.Key.Resource,
			"name", rec.Key.Name,
			"action", rec.Action,
			"rv", rec.ResourceVersion)
	}

	return nextRV, nil
}

func (p *pollingNotifier) send(_ context.Context, _ *resource.WrittenEvent) {
	// No-op for polling strategy - changes are detected via polling.
}

func (p *pollingNotifier) close() {
	// No-op for polling strategy.
}
