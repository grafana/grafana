package sender

import (
	"net/http"
	"sync"

	"github.com/go-kit/log"
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
