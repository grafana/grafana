package sender

import (
	"context"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	common_config "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/discovery"
	"github.com/prometheus/prometheus/notifier"
	"github.com/prometheus/prometheus/pkg/labels"
)

const (
	defaultMaxQueueCapacity = 10000
	defaultTimeout          = 10 * time.Second
)

// Sender is responsible for dispatching alert notifications to an external Alertmanager service.
type Sender struct {
	logger      log.Logger
	gokitLogger gokit_log.Logger
	wg          sync.WaitGroup

	manager *notifier.Manager

	sdCancel  context.CancelFunc
	sdManager *discovery.Manager
}

func New(metrics *metrics.Metrics) (*Sender, error) {
	l := log.New("sender")
	sdCtx, sdCancel := context.WithCancel(context.Background())
	s := &Sender{
		logger:      l,
		gokitLogger: gokit_log.NewLogfmtLogger(logging.NewWrapper(l)),
		sdCancel:    sdCancel,
	}

	s.manager = notifier.NewManager(
		&notifier.Options{QueueCapacity: defaultMaxQueueCapacity, Registerer: prometheus.NewRegistry()},
		s.gokitLogger,
	)

	s.sdManager = discovery.NewManager(sdCtx, s.gokitLogger)

	return s, nil
}

// ApplyConfig syncs a configuration with the sender.
func (s *Sender) ApplyConfig(cfg *ngmodels.AdminConfiguration) error {
	notifierCfg, err := buildNotifierConfig(cfg)
	if err != nil {
		return err
	}

	if err := s.manager.ApplyConfig(notifierCfg); err != nil {
		return err
	}

	sdCfgs := make(map[string]discovery.Configs)
	for k, v := range notifierCfg.AlertingConfig.AlertmanagerConfigs.ToMap() {
		sdCfgs[k] = v.ServiceDiscoveryConfigs
	}

	return s.sdManager.ApplyConfig(sdCfgs)
}

func (s *Sender) Run() {
	s.wg.Add(2)

	go func() {
		if err := s.sdManager.Run(); err != nil {
			s.logger.Error("failed to start the sender service discovery manager", "err", err)
		}
		s.wg.Done()
	}()

	go func() {
		s.manager.Run(s.sdManager.SyncCh())
		s.wg.Done()
	}()
}

// SendAlerts sends a set of alerts to the configured Alertmanager(s).
func (s *Sender) SendAlerts(alerts apimodels.PostableAlerts) {
	if len(alerts.PostableAlerts) == 0 {
		s.logger.Debug("no alerts to send to external Alertmanager(s)")
		return
	}
	as := make([]*notifier.Alert, 0, len(alerts.PostableAlerts))
	for _, a := range alerts.PostableAlerts {
		na := alertToNotifierAlert(a)
		as = append(as, na)
	}

	s.logger.Debug("sending alerts to the external Alertmanager(s)", "am_count", len(s.manager.Alertmanagers()), "alert_count", len(as))
	s.manager.Send(as...)
}

// Stop shuts down the sender.
func (s *Sender) Stop() {
	s.sdCancel()
	s.manager.Stop()
	s.wg.Wait()
}

// Alertmanagers returns a list of the discovered Alertmanager(s).
func (s *Sender) Alertmanagers() []*url.URL {
	return s.manager.Alertmanagers()
}

// DroppedAlertmanagers returns a list of Alertmanager(s) we no longer send alerts to.
func (s *Sender) DroppedAlertmanagers() []*url.URL {
	return s.manager.DroppedAlertmanagers()
}

func buildNotifierConfig(cfg *ngmodels.AdminConfiguration) (*config.Config, error) {
	amConfigs := make([]*config.AlertmanagerConfig, 0, len(cfg.Alertmanagers))
	for _, amURL := range cfg.Alertmanagers {
		u, err := url.Parse(amURL)
		if err != nil {
			return nil, err
		}

		sdConfig := discovery.Configs{
			discovery.StaticConfig{
				{
					Targets: []model.LabelSet{{model.AddressLabel: model.LabelValue(u.Host)}},
				},
			},
		}

		amConfig := &config.AlertmanagerConfig{
			APIVersion:              config.AlertmanagerAPIVersionV2,
			Scheme:                  u.Scheme,
			PathPrefix:              u.Path,
			Timeout:                 model.Duration(defaultTimeout),
			ServiceDiscoveryConfigs: sdConfig,
		}

		// Check the URL for basic authentication information first
		if u.User != nil {
			amConfig.HTTPClientConfig.BasicAuth = &common_config.BasicAuth{
				Username: u.User.Username(),
			}

			if password, isSet := u.User.Password(); isSet {
				amConfig.HTTPClientConfig.BasicAuth.Password = common_config.Secret(password)
			}
		}
		amConfigs = append(amConfigs, amConfig)
	}

	notifierConfig := &config.Config{
		AlertingConfig: config.AlertingConfig{
			AlertmanagerConfigs: amConfigs,
		},
	}

	return notifierConfig, nil
}

func alertToNotifierAlert(alert models.PostableAlert) *notifier.Alert {
	ls := make(labels.Labels, 0, len(alert.Alert.Labels))
	a := make(labels.Labels, 0, len(alert.Annotations))

	// Prometheus does not allow spaces in labels or annotations while Grafana does, we need to make sure we
	// remove them before sending the alerts.
	for k, v := range alert.Alert.Labels {
		ls = append(ls, labels.Label{Name: removeSpaces(k), Value: v})
	}

	for k, v := range alert.Annotations {
		a = append(a, labels.Label{Name: removeSpaces(k), Value: v})
	}

	return &notifier.Alert{
		Labels:       ls,
		Annotations:  a,
		StartsAt:     time.Time(alert.StartsAt),
		EndsAt:       time.Time(alert.EndsAt),
		GeneratorURL: alert.Alert.GeneratorURL.String(),
	}
}

func removeSpaces(labelName string) string {
	return strings.Join(strings.Fields(labelName), "")
}
