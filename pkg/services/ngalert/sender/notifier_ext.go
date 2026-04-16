// This extension file contains all changed functions that would normally be
// in notifier.go. This helps us to keep track of the changes compared
// to upstream.
// Changes are denoted explicitly by a comment with the prefix "Extension:"

// nolint
package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/discovery/targetgroup"
	"github.com/prometheus/prometheus/model/labels"

	"github.com/grafana/grafana/pkg/util/httpclient"
)

// String constants for instrumentation.
const (
	// Extension: Changed namespace and subsystem from upstream values ("prometheus", "notifications")
	// so that metrics are exposed as grafana_alerting_sender_*
	namespace         = "grafana_alerting"
	subsystem         = "sender"
	alertmanagerLabel = "alertmanager"
	// Extension: New "data_source_uid" label for external Alertmanagers.
	dataSourceUIDLabel = "data_source_uid"
)

func newAlertMetrics(r prometheus.Registerer, queueCap int, queueLen, alertmanagersDiscovered func() float64) *alertMetrics {
	m := &alertMetrics{
		latency: prometheus.NewSummaryVec(prometheus.SummaryOpts{
			Namespace:  namespace,
			Subsystem:  subsystem,
			Name:       "latency_seconds",
			Help:       "Latency quantiles for sending alert notifications.",
			Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		},
			// Extension: Added "data_source_uid" label.
			[]string{alertmanagerLabel, dataSourceUIDLabel},
		),
		errors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "errors_total",
			Help:      "Total number of sent alerts affected by errors.",
		},
			// Extension: Added "data_source_uid" label.
			[]string{alertmanagerLabel, dataSourceUIDLabel},
		),
		sent: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "sent_total",
			Help:      "Total number of alerts sent.",
		},
			// Extension: Added "data_source_uid" label.
			[]string{alertmanagerLabel, dataSourceUIDLabel},
		),
		dropped: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "dropped_total",
			Help:      "Total number of alerts dropped due to errors when sending to Alertmanager.",
		}),
		queueLength: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "queue_length",
			Help:      "The number of alert notifications in the queue.",
		}, queueLen),
		queueCapacity: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "queue_capacity",
			Help:      "The capacity of the alert notifications queue.",
		}),
		alertmanagersDiscovered: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			// Extension: Now using 'namespace' and 'subsystem' instead of full string in 'Name'.
			Name: "alertmanagers_discovered",
			Help: "The number of alertmanagers discovered and active.",
		}, alertmanagersDiscovered),
	}

	m.queueCapacity.Set(float64(queueCap))

	if r != nil {
		r.MustRegister(
			m.latency,
			m.errors,
			m.sent,
			m.dropped,
			m.queueLength,
			m.queueCapacity,
			m.alertmanagersDiscovered,
		)
	}

	return m
}

func do(ctx context.Context, client *http.Client, req *http.Request) (*http.Response, error) {
	if client == nil {
		client = httpclient.New()
	}
	return client.Do(req.WithContext(ctx))
}

// ApplyConfig updates the status state as the new config requires.
// Extension: add new parameters headers and dataSourceUIDs.
func (n *Manager) ApplyConfig(conf *config.Config, headers map[string]http.Header, dataSourceUIDs map[string]string) error {
	n.mtx.Lock()
	defer n.mtx.Unlock()

	n.opts.ExternalLabels = conf.GlobalConfig.ExternalLabels
	n.opts.RelabelConfigs = conf.AlertingConfig.AlertRelabelConfigs

	amSets := make(map[string]*alertmanagerSet)
	// configToAlertmanagers maps alertmanager sets for each unique AlertmanagerConfig,
	// helping to avoid dropping known alertmanagers and re-use them without waiting for SD updates when applying the config.
	configToAlertmanagers := make(map[string]*alertmanagerSet, len(n.alertmanagers))
	for _, oldAmSet := range n.alertmanagers {
		hash, err := oldAmSet.configHash()
		if err != nil {
			return err
		}
		configToAlertmanagers[hash] = oldAmSet
	}

	for k, cfg := range conf.AlertingConfig.AlertmanagerConfigs.ToMap() {
		ams, err := newAlertmanagerSet(cfg, n.logger, n.metrics)
		if err != nil {
			return err
		}

		hash, err := ams.configHash()
		if err != nil {
			return err
		}

		if oldAmSet, ok := configToAlertmanagers[hash]; ok {
			ams.ams = oldAmSet.ams
			ams.droppedAms = oldAmSet.droppedAms
		}

		// Extension: set the headers to the alertmanager set.
		if headers, ok := headers[k]; ok {
			ams.headers = headers
		}
		// Extension: set the data source UID to the alertmanager set.
		if uid, ok := dataSourceUIDs[k]; ok {
			ams.dataSourceUID = uid
		}
		amSets[k] = ams
	}

	n.alertmanagers = amSets

	return nil
}

// alertmanagerSet contains a set of Alertmanagers discovered via a group of service
// discovery definitions that have a common configuration on how alerts should be sent.
type alertmanagerSet struct {
	cfg    *config.AlertmanagerConfig
	client *http.Client

	// Extension: headers that should be used for the http requests to the alertmanagers.
	headers http.Header
	// Extension: dataSourceUID is the UID of the data source this alertmanager set was configured from.
	dataSourceUID string

	metrics *alertMetrics

	mtx        sync.RWMutex
	ams        []alertmanager
	droppedAms []alertmanager
	logger     *slog.Logger
}

// sendAll sends the alerts to all configured Alertmanagers concurrently.
// It returns true if the alerts could be sent successfully to at least one Alertmanager.
// Extension: passing headers from each ams to sendOne
func (n *Manager) sendAll(alerts ...*Alert) bool {
	if len(alerts) == 0 {
		return true
	}

	begin := time.Now()

	// cachedPayload represent 'alerts' marshaled for Alertmanager API v2.
	// Marshaling happens below. Reference here is for caching between
	// for loop iterations.
	var cachedPayload []byte

	n.mtx.RLock()
	amSets := n.alertmanagers
	n.mtx.RUnlock()

	var (
		wg           sync.WaitGroup
		amSetCovered sync.Map
	)
	for k, ams := range amSets {
		var (
			payload  []byte
			err      error
			amAlerts = alerts
		)

		ams.mtx.RLock()

		if len(ams.ams) == 0 {
			ams.mtx.RUnlock()
			continue
		}

		if len(ams.cfg.AlertRelabelConfigs) > 0 {
			amAlerts = relabelAlerts(ams.cfg.AlertRelabelConfigs, labels.Labels{}, alerts)
			if len(amAlerts) == 0 {
				ams.mtx.RUnlock()
				continue
			}
			// We can't use the cached values from previous iteration.
			cachedPayload = nil
		}

		switch ams.cfg.APIVersion {
		case config.AlertmanagerAPIVersionV2:
			{
				if cachedPayload == nil {
					openAPIAlerts := alertsToOpenAPIAlerts(amAlerts)

					cachedPayload, err = json.Marshal(openAPIAlerts)
					if err != nil {
						n.logger.Error("Encoding alerts for Alertmanager API v2 failed", "err", err)
						ams.mtx.RUnlock()
						return false
					}
				}

				payload = cachedPayload
			}
		default:
			{
				n.logger.Error(
					fmt.Sprintf("Invalid Alertmanager API version '%v', expected one of '%v'", ams.cfg.APIVersion, config.SupportedAlertmanagerAPIVersions),
					"err", err,
				)
				ams.mtx.RUnlock()
				return false
			}
		}

		if len(ams.cfg.AlertRelabelConfigs) > 0 {
			// We can't use the cached values on the next iteration.
			cachedPayload = nil
		}

		// Being here means len(ams.ams) > 0
		amSetCovered.Store(k, false)
		for _, am := range ams.ams {
			wg.Add(1)

			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(ams.cfg.Timeout))
			defer cancel()

			// Extension: added headers and dataSourceUID parameters/labels.
			go func(ctx context.Context, k string, client *http.Client, url string, payload []byte, count int, headers http.Header, dsUID string) {
				err := n.sendOne(ctx, client, url, payload, headers)
				if err != nil {
					n.logger.Error("Error sending alerts", "alertmanager", url, "data_source_uid", dsUID, "count", count, "err", err)
					n.metrics.errors.WithLabelValues(url, dsUID).Add(float64(count))
				} else {
					amSetCovered.CompareAndSwap(k, false, true)
				}

				n.metrics.latency.WithLabelValues(url, dsUID).Observe(time.Since(begin).Seconds())
				n.metrics.sent.WithLabelValues(url, dsUID).Add(float64(count))

				wg.Done()
			}(ctx, k, ams.client, am.url().String(), payload, len(amAlerts), ams.headers, ams.dataSourceUID)
		}

		ams.mtx.RUnlock()
	}

	wg.Wait()

	// Return false if there are any sets which were attempted (e.g. not filtered
	// out) but have no successes.
	allAmSetsCovered := true
	amSetCovered.Range(func(_, value any) bool {
		if !value.(bool) {
			allAmSetsCovered = false
			return false
		}
		return true
	})

	return allAmSetsCovered
}

// Extension: added headers parameter.
func (n *Manager) sendOne(ctx context.Context, c *http.Client, url string, b []byte, headers http.Header) error {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", contentTypeJSON)
	// Extension: set headers.
	for k, v := range headers {
		for _, vv := range v {
			req.Header.Set(k, vv)
		}
	}
	resp, err := n.opts.Do(ctx, c, req)
	if err != nil {
		return err
	}
	defer func() {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()

	// Any HTTP status 2xx is OK.
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("bad response status %s", resp.Status)
	}

	return nil
}

// sync extracts a deduplicated set of Alertmanager endpoints from a list
// of target groups definitions.
func (s *alertmanagerSet) sync(tgs []*targetgroup.Group) {
	allAms := []alertmanager{}
	allDroppedAms := []alertmanager{}

	for _, tg := range tgs {
		ams, droppedAms, err := AlertmanagerFromGroup(tg, s.cfg)
		if err != nil {
			s.logger.Error("Creating discovered Alertmanagers failed", "err", err)
			continue
		}
		allAms = append(allAms, ams...)
		allDroppedAms = append(allDroppedAms, droppedAms...)
	}

	s.mtx.Lock()
	defer s.mtx.Unlock()
	previousAms := s.ams
	// Set new Alertmanagers and deduplicate them along their unique URL.
	s.ams = []alertmanager{}
	s.droppedAms = []alertmanager{}
	s.droppedAms = append(s.droppedAms, allDroppedAms...)
	seen := map[string]struct{}{}

	for _, am := range allAms {
		us := am.url().String()
		if _, ok := seen[us]; ok {
			continue
		}

		// This will initialize the Counters for the AM to 0.
		// Extension: Add "data_source_uid" label.
		s.metrics.sent.WithLabelValues(us, s.dataSourceUID)
		s.metrics.errors.WithLabelValues(us, s.dataSourceUID)

		seen[us] = struct{}{}
		s.ams = append(s.ams, am)
	}
	// Now remove counters for any removed Alertmanagers.
	for _, am := range previousAms {
		us := am.url().String()
		if _, ok := seen[us]; ok {
			continue
		}
		// Extension: Add "data_source_uid" label.
		s.metrics.latency.DeleteLabelValues(us, s.dataSourceUID)
		s.metrics.sent.DeleteLabelValues(us, s.dataSourceUID)
		s.metrics.errors.DeleteLabelValues(us, s.dataSourceUID)
		seen[us] = struct{}{}
	}
}
