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

	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/model/labels"
)

// ApplyConfig updates the status state as the new config requires.
// Extension: add new parameter headers.
func (n *Manager) ApplyConfig(conf *config.Config, headers map[string]http.Header) error {
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

			// Extension: added headers parameter.
			go func(ctx context.Context, k string, client *http.Client, url string, payload []byte, count int, headers http.Header) {
				err := n.sendOne(ctx, client, url, payload, headers)
				if err != nil {
					n.logger.Error("Error sending alerts", "alertmanager", url, "count", count, "err", err)
					n.metrics.errors.WithLabelValues(url).Add(float64(count))
				} else {
					amSetCovered.CompareAndSwap(k, false, true)
				}

				n.metrics.latency.WithLabelValues(url).Observe(time.Since(begin).Seconds())
				n.metrics.sent.WithLabelValues(url).Add(float64(count))

				wg.Done()
			}(ctx, k, ams.client, am.url().String(), payload, len(amAlerts), ams.headers)
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
