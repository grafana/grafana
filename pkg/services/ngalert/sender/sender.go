package sender

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	common_config "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/discovery"
	"github.com/prometheus/prometheus/model/labels"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

const (
	defaultMaxQueueCapacity = 10000
	defaultTimeout          = 10 * time.Second
)

// ExternalAlertmanager is responsible for dispatching alert notifications to an external Alertmanager service.
type ExternalAlertmanager struct {
	logger log.Logger
	wg     sync.WaitGroup

	manager *Manager

	sdCancel  context.CancelFunc
	sdManager *discovery.Manager
}

func NewExternalAlertmanagerSender() *ExternalAlertmanager {
	l := log.New("ngalert.sender.external-alertmanager")
	sdCtx, sdCancel := context.WithCancel(context.Background())
	s := &ExternalAlertmanager{
		logger:   l,
		sdCancel: sdCancel,
	}

	s.manager = NewManager(
		// Injecting a new registry here means these metrics are not exported.
		// Once we fix the individual Alertmanager metrics we should fix this scenario too.
		&Options{QueueCapacity: defaultMaxQueueCapacity, Registerer: prometheus.NewRegistry()},
		s.logger,
	)

	s.sdManager = discovery.NewManager(sdCtx, s.logger)

	return s
}

// ApplyConfig syncs a configuration with the sender.
func (s *ExternalAlertmanager) ApplyConfig(orgId, id int64, alertmanagers []string) error {
	notifierCfg, err := buildNotifierConfig(alertmanagers)
	if err != nil {
		return err
	}

	s.logger = s.logger.New("org", orgId, "cfg", id)

	s.logger.Info("Synchronizing config with external Alertmanager group")
	if err := s.manager.ApplyConfig(notifierCfg); err != nil {
		return err
	}

	sdCfgs := make(map[string]discovery.Configs)
	for k, v := range notifierCfg.AlertingConfig.AlertmanagerConfigs.ToMap() {
		sdCfgs[k] = v.ServiceDiscoveryConfigs
	}

	return s.sdManager.ApplyConfig(sdCfgs)
}

func (s *ExternalAlertmanager) Run() {
	s.wg.Add(2)

	go func() {
		s.logger.Info("Initiating communication with a group of external Alertmanagers")

		if err := s.sdManager.Run(); err != nil {
			s.logger.Error("Failed to start the sender service discovery manager", "error", err)
		}
		s.wg.Done()
	}()

	go func() {
		s.manager.Run(s.sdManager.SyncCh())
		s.wg.Done()
	}()
}

// SendAlerts sends a set of alerts to the configured Alertmanager(s).
func (s *ExternalAlertmanager) SendAlerts(alerts apimodels.PostableAlerts) {
	if len(alerts.PostableAlerts) == 0 {
		return
	}
	as := make([]*Alert, 0, len(alerts.PostableAlerts))
	for _, a := range alerts.PostableAlerts {
		na := s.alertToNotifierAlert(a)
		as = append(as, na)
	}

	s.manager.Send(as...)
}

// Stop shuts down the sender.
func (s *ExternalAlertmanager) Stop() {
	s.logger.Info("Shutting down communication with the external Alertmanager group")
	s.sdCancel()
	s.manager.Stop()
	s.wg.Wait()
}

// Alertmanagers returns a list of the discovered Alertmanager(s).
func (s *ExternalAlertmanager) Alertmanagers() []*url.URL {
	return s.manager.Alertmanagers()
}

// DroppedAlertmanagers returns a list of Alertmanager(s) we no longer send alerts to.
func (s *ExternalAlertmanager) DroppedAlertmanagers() []*url.URL {
	return s.manager.DroppedAlertmanagers()
}

func buildNotifierConfig(alertmanagers []string) (*Config, error) {
	amConfigs := make([]*AlertmanagerConfig, 0, len(alertmanagers))
	for _, amURL := range alertmanagers {
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

		amConfig := &AlertmanagerConfig{
			APIVersion:              AlertmanagerAPIVersionV2,
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

	notifierConfig := &Config{
		AlertingConfig: AlertingConfig{
			AlertmanagerConfigs: amConfigs,
		},
	}

	return notifierConfig, nil
}

func (s *ExternalAlertmanager) alertToNotifierAlert(alert models.PostableAlert) *Alert {
	// Prometheus alertmanager has stricter rules for annotations/labels than grafana's internal alertmanager, so we sanitize invalid keys.
	return &Alert{
		Labels:       s.sanitizeLabelSet(alert.Alert.Labels),
		Annotations:  s.sanitizeLabelSet(alert.Annotations),
		StartsAt:     time.Time(alert.StartsAt),
		EndsAt:       time.Time(alert.EndsAt),
		GeneratorURL: alert.Alert.GeneratorURL.String(),
	}
}

// sanitizeLabelSet sanitizes all given LabelSet keys according to sanitizeLabelName.
// If there is a collision as a result of sanitization, a short (6 char) md5 hash of the original key will be added as a suffix.
func (s *ExternalAlertmanager) sanitizeLabelSet(lbls models.LabelSet) labels.Labels {
	ls := make(labels.Labels, 0, len(lbls))
	set := make(map[string]struct{})

	// Must sanitize labels in order otherwise resulting label set can be inconsistent when there are collisions.
	for _, k := range sortedKeys(lbls) {
		sanitizedLabelName, err := s.sanitizeLabelName(k)
		if err != nil {
			s.logger.Error("Alert sending to external Alertmanager(s) contains an invalid label/annotation name that failed to sanitize, skipping", "name", k, "error", err)
			continue
		}

		// There can be label name collisions after we sanitize. We check for this and attempt to make the name unique again using a short hash of the original name.
		if _, ok := set[sanitizedLabelName]; ok {
			sanitizedLabelName = sanitizedLabelName + fmt.Sprintf("_%.3x", md5.Sum([]byte(k)))
			s.logger.Warn("Alert contains duplicate label/annotation name after sanitization, appending unique suffix", "name", k, "newName", sanitizedLabelName, "error", err)
		}

		set[sanitizedLabelName] = struct{}{}
		ls = append(ls, labels.Label{Name: sanitizedLabelName, Value: lbls[k]})
	}

	return ls
}

// sanitizeLabelName will fix a given label name so that it is compatible with prometheus alertmanager character restrictions.
// Prometheus alertmanager requires labels to match ^[a-zA-Z_][a-zA-Z0-9_]*$.
// Characters with an ASCII code < 127 will be replaced with an underscore (_), characters with ASCII code >= 127 will be replaced by their hex representation.
// For backwards compatibility, whitespace will be removed instead of replaced with an underscore.
func (s *ExternalAlertmanager) sanitizeLabelName(name string) (string, error) {
	if len(name) == 0 {
		return "", errors.New("label name cannot be empty")
	}

	if isValidLabelName(name) {
		return name, nil
	}

	s.logger.Warn("Alert sending to external Alertmanager(s) contains label/annotation name with invalid characters", "name", name)

	// Remove spaces. We do this instead of replacing with underscore for backwards compatibility as this existed before the rest of this function.
	sanitized := strings.Join(strings.Fields(name), "")

	// Replace other invalid characters.
	var buf strings.Builder
	for i, b := range sanitized {
		if isValidCharacter(i, b) {
			buf.WriteRune(b)
			continue
		}

		if b <= unicode.MaxASCII {
			buf.WriteRune('_')
			continue
		}

		if i == 0 {
			buf.WriteRune('_')
		}
		_, _ = fmt.Fprintf(&buf, "%#x", b)
	}

	if buf.Len() == 0 {
		return "", fmt.Errorf("label name is empty after removing invalids chars")
	}

	return buf.String(), nil
}

// isValidLabelName is true iff the label name matches the pattern of ^[a-zA-Z_][a-zA-Z0-9_]*$.
func isValidLabelName(ln string) bool {
	if len(ln) == 0 {
		return false
	}
	for i, b := range ln {
		if !isValidCharacter(i, b) {
			return false
		}
	}
	return true
}

// isValidCharacter checks if a specific rune is allowed at the given position in a label key for an external Prometheus alertmanager.
// From alertmanager LabelName.IsValid().
func isValidCharacter(pos int, b rune) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_' || (b >= '0' && b <= '9' && pos > 0)
}

func sortedKeys(m map[string]string) []string {
	orderedKeys := make([]string, len(m))
	i := 0
	for k := range m {
		orderedKeys[i] = k
		i++
	}
	sort.Strings(orderedKeys)
	return orderedKeys
}
