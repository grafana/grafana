package sender

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"net/http"
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
	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/discovery"
	"github.com/prometheus/prometheus/model/labels"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

const (
	defaultMaxQueueCapacity = 10000
	defaultTimeout          = 10 * time.Second
	defaultDrainOnShutdown  = true
)

// ExternalAlertmanager is responsible for dispatching alert notifications to an external Alertmanager service.
type ExternalAlertmanager struct {
	logger log.Logger
	wg     sync.WaitGroup

	manager *Manager

	sdCancel  context.CancelFunc
	sdManager *discovery.Manager
	options   *ExternalAMOptions
}

type ExternalAMcfg struct {
	URL     string
	Headers http.Header
	Timeout time.Duration
}

type ExternalAMOptions struct {
	Options
	sanitizeLabelSetFn func(lbls models.LabelSet) labels.Labels
}

type Option func(*ExternalAMOptions)

type doFunc func(context.Context, *http.Client, *http.Request) (*http.Response, error)

// WithDoFunc receives a function to use when making HTTP requests from the Manager.
func WithDoFunc(doFunc doFunc) Option {
	return func(opts *ExternalAMOptions) {
		opts.Do = doFunc
	}
}

// WithUTF8Labels skips sanitizing labels and annotations before sending alerts to the external Alertmanager(s).
// It assumes UTF-8 label names are supported by the Alertmanager(s).
func WithUTF8Labels() Option {
	return func(opts *ExternalAMOptions) {
		opts.sanitizeLabelSetFn = func(lbls models.LabelSet) labels.Labels {
			ls := make(labels.Labels, 0, len(lbls))
			for k, v := range lbls {
				ls = append(ls, labels.Label{Name: k, Value: v})
			}
			return ls
		}
	}
}

// WithMaxQueueCapacity sets the maximum capacity of the queue used by the sender.
func WithMaxQueueCapacity(capacity int) Option {
	return func(opts *ExternalAMOptions) {
		opts.QueueCapacity = capacity
	}
}

// WithMaxBatchSize sets the maximum batch size for sending alerts to the external Alertmanager(s).
func WithMaxBatchSize(size int) Option {
	return func(opts *ExternalAMOptions) {
		opts.MaxBatchSize = size
	}
}

func (cfg *ExternalAMcfg) SHA256() string {
	return asSHA256([]string{cfg.headerString(), cfg.URL})
}

// headersString transforms all the headers in a sorted way as a
// single string so it can be used for hashing and comparing.
func (cfg *ExternalAMcfg) headerString() string {
	var result strings.Builder

	headerKeys := make([]string, 0, len(cfg.Headers))
	for key := range cfg.Headers {
		headerKeys = append(headerKeys, key)
	}

	sort.Strings(headerKeys)

	for _, key := range headerKeys {
		result.WriteString(fmt.Sprintf("%s:%s", key, cfg.Headers[key]))
	}

	return result.String()
}

func NewExternalAlertmanagerSender(l log.Logger, reg prometheus.Registerer, opts ...Option) (*ExternalAlertmanager, error) {
	sdCtx, sdCancel := context.WithCancel(context.Background())

	options := &ExternalAMOptions{
		Options: Options{
			QueueCapacity:   defaultMaxQueueCapacity,
			MaxBatchSize:    DefaultMaxBatchSize,
			Registerer:      reg,
			DrainOnShutdown: defaultDrainOnShutdown,
		},
	}

	for _, opt := range opts {
		opt(options)
	}

	s := &ExternalAlertmanager{
		logger:   l,
		sdCancel: sdCancel,
		options:  options,
	}

	if options.sanitizeLabelSetFn == nil {
		options.sanitizeLabelSetFn = s.sanitizeLabelSet
	}

	s.manager = NewManager(
		// Injecting a new registry here means these metrics are not exported.
		// Once we fix the individual Alertmanager metrics we should fix this scenario too.
		&options.Options,
		toSlogLogger(s.logger),
	)
	sdMetrics, err := discovery.CreateAndRegisterSDMetrics(prometheus.NewRegistry())
	if err != nil {
		s.logger.Error("failed to register service discovery metrics", "error", err)
		return nil, err
	}
	// Convert s.Logger to slog.Logger using the adapter
	slogLogger := toSlogLogger(s.logger)
	s.sdManager = discovery.NewManager(sdCtx, slogLogger, prometheus.NewRegistry(), sdMetrics)

	if s.sdManager == nil {
		return nil, errors.New("failed to create new discovery manager")
	}

	return s, nil
}

// ApplyConfig syncs a configuration with the sender.
func (s *ExternalAlertmanager) ApplyConfig(orgId, id int64, alertmanagers []ExternalAMcfg) error {
	notifierCfg, headers, err := buildNotifierConfig(alertmanagers)
	if err != nil {
		return err
	}

	s.logger = s.logger.New("org", orgId, "cfg", id)

	s.logger.Info("Synchronizing config with external Alertmanager group")
	if err := s.manager.ApplyConfig(notifierCfg, headers); err != nil {
		return err
	}

	sdCfgs := make(map[string]discovery.Configs)
	for k, v := range notifierCfg.AlertingConfig.AlertmanagerConfigs.ToMap() {
		sdCfgs[k] = v.ServiceDiscoveryConfigs
	}

	return s.sdManager.ApplyConfig(sdCfgs)
}

func (s *ExternalAlertmanager) Run() {
	logger := s.logger
	s.wg.Add(2)

	go func() {
		logger.Info("Initiating communication with a group of external Alertmanagers")

		if err := s.sdManager.Run(); err != nil {
			logger.Error("Failed to start the sender service discovery manager", "error", err)
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

		s.logger.Debug(
			"Sending alert",
			"alert",
			na.String(),
			"starts_at",
			na.StartsAt,
			"ends_at",
			na.EndsAt)
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

func buildNotifierConfig(alertmanagers []ExternalAMcfg) (*config.Config, map[string]http.Header, error) {
	amConfigs := make([]*config.AlertmanagerConfig, 0, len(alertmanagers))
	headers := map[string]http.Header{}
	for i, am := range alertmanagers {
		u, err := url.Parse(am.URL)
		if err != nil {
			return nil, nil, err
		}

		sdConfig := discovery.Configs{
			discovery.StaticConfig{
				{
					Targets: []model.LabelSet{{model.AddressLabel: model.LabelValue(u.Host)}},
				},
			},
		}

		timeout := am.Timeout
		if timeout == 0 {
			timeout = defaultTimeout
		}

		amConfig := &config.AlertmanagerConfig{
			APIVersion:              config.AlertmanagerAPIVersionV2,
			Scheme:                  u.Scheme,
			PathPrefix:              u.Path,
			Timeout:                 model.Duration(timeout),
			ServiceDiscoveryConfigs: sdConfig,
		}

		if am.Headers != nil {
			// The key has the same format as the AlertmanagerConfigs.ToMap() would generate
			// so we can use it later on when working with the alertmanager config map.
			headers[fmt.Sprintf("config-%d", i)] = am.Headers
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

	return notifierConfig, headers, nil
}

func (s *ExternalAlertmanager) alertToNotifierAlert(alert models.PostableAlert) *Alert {
	// Prometheus alertmanager has stricter rules for annotations/labels than grafana's internal alertmanager, so we sanitize invalid keys.
	return &Alert{
		Labels:       s.options.sanitizeLabelSetFn(alert.Labels),
		Annotations:  s.options.sanitizeLabelSetFn(alert.Annotations),
		StartsAt:     time.Time(alert.StartsAt),
		EndsAt:       time.Time(alert.EndsAt),
		GeneratorURL: alert.GeneratorURL.String(),
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
