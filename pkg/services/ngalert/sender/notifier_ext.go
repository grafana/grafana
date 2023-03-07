package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"sync"
	"time"

	"go.uber.org/atomic"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/prometheus/config"
)

// ApplyConfig updates the status state as the new config requires.
// Extension: add new parameter headers.
func (n *Manager) ApplyConfig(conf *config.Config, headers map[string]map[string]string) error {
	n.mtx.Lock()
	defer n.mtx.Unlock()

	n.opts.ExternalLabels = conf.GlobalConfig.ExternalLabels
	n.opts.RelabelConfigs = conf.AlertingConfig.AlertRelabelConfigs

	amSets := make(map[string]*alertmanagerSet)

	for k, cfg := range conf.AlertingConfig.AlertmanagerConfigs.ToMap() {
		ams, err := newAlertmanagerSet(cfg, n.logger, n.metrics)
		if err != nil {
			return err
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
	headers map[string]string

	metrics *alertMetrics

	mtx        sync.RWMutex
	ams        []alertmanager
	droppedAms []alertmanager
	logger     log.Logger
}

// sendAll sends the alerts to all configured Alertmanagers concurrently.
// It returns true if the alerts could be sent successfully to at least one Alertmanager.
func (n *Manager) sendAll(alerts ...*Alert) bool {
	if len(alerts) == 0 {
		return true
	}

	begin := time.Now()

	// v1Payload and v2Payload represent 'alerts' marshaled for Alertmanager API
	// v1 or v2. Marshaling happens below. Reference here is for caching between
	// for loop iterations.
	var v1Payload, v2Payload []byte

	n.mtx.RLock()
	amSets := n.alertmanagers
	n.mtx.RUnlock()

	var (
		wg         sync.WaitGroup
		numSuccess atomic.Uint64
	)
	for _, ams := range amSets {
		var (
			payload []byte
			err     error
		)

		ams.mtx.RLock()

		switch ams.cfg.APIVersion {
		case config.AlertmanagerAPIVersionV1:
			{
				if v1Payload == nil {
					v1Payload, err = json.Marshal(alerts)
					if err != nil {
						level.Error(n.logger).Log("msg", "Encoding alerts for Alertmanager API v1 failed", "err", err)
						ams.mtx.RUnlock()
						return false
					}
				}

				payload = v1Payload
			}
		case config.AlertmanagerAPIVersionV2:
			{
				if v2Payload == nil {
					openAPIAlerts := alertsToOpenAPIAlerts(alerts)

					v2Payload, err = json.Marshal(openAPIAlerts)
					if err != nil {
						level.Error(n.logger).Log("msg", "Encoding alerts for Alertmanager API v2 failed", "err", err)
						ams.mtx.RUnlock()
						return false
					}
				}

				payload = v2Payload
			}
		default:
			{
				level.Error(n.logger).Log(
					"msg", fmt.Sprintf("Invalid Alertmanager API version '%v', expected one of '%v'", ams.cfg.APIVersion, config.SupportedAlertmanagerAPIVersions),
					"err", err,
				)
				ams.mtx.RUnlock()
				return false
			}
		}

		for _, am := range ams.ams {
			wg.Add(1)

			ctx, cancel := context.WithTimeout(n.ctx, time.Duration(ams.cfg.Timeout))
			defer cancel()

			// Extension: added headers parameter.
			go func(client *http.Client, url string, headers map[string]string) {
				if err := n.sendOne(ctx, client, url, payload, headers); err != nil {
					level.Error(n.logger).Log("alertmanager", url, "count", len(alerts), "msg", "Error sending alert", "err", err)
					n.metrics.errors.WithLabelValues(url).Inc()
				} else {
					numSuccess.Inc()
				}
				n.metrics.latency.WithLabelValues(url).Observe(time.Since(begin).Seconds())
				n.metrics.sent.WithLabelValues(url).Add(float64(len(alerts)))

				wg.Done()
			}(ams.client, am.url().String(), ams.headers)
		}

		ams.mtx.RUnlock()
	}

	wg.Wait()

	return numSuccess.Load() > 0
}

// Extension: added headers parameter.
func (n *Manager) sendOne(ctx context.Context, c *http.Client, url string, b []byte, headers map[string]string) error {
	req, err := http.NewRequest("POST", url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", contentTypeJSON)
	// Extension: set headers.
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := n.opts.Do(ctx, c, req)
	if err != nil {
		return err
	}
	defer func() {
		io.Copy(ioutil.Discard, resp.Body)
		resp.Body.Close()
	}()

	// Any HTTP status 2xx is OK.
	if resp.StatusCode/100 != 2 {
		return errors.Errorf("bad response status %s", resp.Status)
	}

	return nil
}
