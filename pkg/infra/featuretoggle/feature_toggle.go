package featuretoggle

import (
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/client_golang/prometheus"
)

var featureToggleGauge = prometheus.NewGaugeVec(prometheus.GaugeOpts{
	Name:      "feature_toggle",
	Help:      "A metric value labeled by feature telling if a feature is enabled ('1') or not ('0')",
	Namespace: "grafana",
}, []string{"feature"})

func init() {
	prometheus.MustRegister(featureToggleGauge)
}

func ProvideService(cfg *setting.Cfg) (*Service, error) {
	logger := log.New("feature-toggle")
	features := map[string]bool{}
	sec := cfg.Raw.Section("feature_toggles")

	for _, k := range sec.Keys() {
		key := k.Name()
		if key == "enable" {
			continue
		}

		enabled := k.MustBool(false)
		enabled = cfg.SectionWithEnvOverrides("feature_toggles").Key(key).MustBool(enabled)
		features[key] = enabled

		label, err := metricutil.SanitizeLabelName(key)
		if err != nil {
			return nil, err
		}

		if enabled {
			featureToggleGauge.WithLabelValues(label).Set(1)
		} else {
			featureToggleGauge.WithLabelValues(label).Set(0)
		}
	}

	if enabledStr := sec.Key("enable").MustString(""); enabledStr != "" {
		logger.Warn("Use of the enable setting is deprecated. Please use a setting per feature toggle instead.")
		for _, feature := range util.SplitString(enabledStr) {
			features[feature] = true
			label, err := metricutil.SanitizeLabelName(feature)
			if err != nil {
				return nil, err
			}
			featureToggleGauge.WithLabelValues(label).Set(1)
		}
	}

	return &Service{
		log:      logger,
		cfg:      cfg,
		features: features,
		mutex:    &sync.RWMutex{},
	}, nil
}

type Service struct {
	log      log.Logger
	cfg      *setting.Cfg
	features map[string]bool
	mutex    *sync.RWMutex
}

func (s *Service) IsEnabled(feature string) bool {
	s.mutex.RLock()
	enabled, exists := s.features[feature]
	if exists {
		s.mutex.RUnlock()
		return enabled
	}

	s.mutex.Lock()
	enabled, exists = s.features[feature]
	if exists {
		s.mutex.Unlock()
		return enabled
	}

	defer s.mutex.Unlock()

	// In case feature toggle not in defaults.ini and overridden by env variable we try to
	// read the value from the env variable.
	s.features[feature] = s.cfg.SectionWithEnvOverrides("feature_toggles").Key(feature).MustBool(false)
	label, err := metricutil.SanitizeLabelName(feature)
	if err != nil {
		s.log.Error("failed to sanitize label name", "error", err)
		return s.features[feature]
	}

	if s.features[feature] {
		featureToggleGauge.WithLabelValues(label).Set(1)
	} else {
		featureToggleGauge.WithLabelValues(label).Set(0)
	}

	return s.features[feature]
}
