package setting

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/ini.v1"
)

var (
	featureToggleInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "feature_toggles_info",
		Help:      "info metric that exposes what feature toggles are enabled or not",
		Namespace: "grafana",
	}, []string{"name"})

	defaultFeatureToggles = map[string]bool{
		"recordedQueries":               false,
		"accesscontrol":                 false,
		"service-accounts":              false,
		"httpclientprovider_azure_auth": false,
	}
)

func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	toggles, err := overrideDefaultWithConfiguration(iniFile, defaultFeatureToggles)
	if err != nil {
		return err
	}

	cfg.FeatureToggles = toggles

	return nil
}

func overrideDefaultWithConfiguration(iniFile *ini.File, featureToggles map[string]bool) (map[string]bool, error) {
	// Read and populate feature toggles list
	featureTogglesSection := iniFile.Section("feature_toggles")

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		featureToggles[feature] = true
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		b, err := strconv.ParseBool(v.Value())
		if err != nil {
			return featureToggles, err
		}

		featureToggles[v.Name()] = b
	}

	// track if feature toggles are enabled or not using an info metric
	for k, v := range featureToggles {
		if v {
			featureToggleInfo.WithLabelValues(k).Set(1)
		} else {
			featureToggleInfo.WithLabelValues(k).Set(0)
		}
	}

	return featureToggles, nil
}
