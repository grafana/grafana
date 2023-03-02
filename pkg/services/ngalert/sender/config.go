// THIS FILE IS COPIED FROM UPSTREAM
//
// Copyright 2015 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//nolint
package sender

import (
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/alecthomas/units"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/sigv4"
	yaml "gopkg.in/yaml.v2"

	"github.com/prometheus/prometheus/discovery"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/pkg/relabel"
)

var (
	patRulePath     = regexp.MustCompile(`^[^*]*(\*[^/]*)?$`)
	reservedHeaders = map[string]struct{}{
		// NOTE: authorization is checked specially,
		// see RemoteWriteConfig.UnmarshalYAML.
		// "authorization":                  {},
		"host":                              {},
		"content-encoding":                  {},
		"content-length":                    {},
		"content-type":                      {},
		"user-agent":                        {},
		"connection":                        {},
		"keep-alive":                        {},
		"proxy-authenticate":                {},
		"proxy-authorization":               {},
		"www-authenticate":                  {},
		"accept-encoding":                   {},
		"x-prometheus-remote-write-version": {},
		"x-prometheus-remote-read-version":  {},

		// Added by SigV4.
		"x-amz-date":           {},
		"x-amz-security-token": {},
		"x-amz-content-sha256": {},
	}
)

// Load parses the YAML input s into a Config.
func Load(s string, expandExternalLabels bool, logger log.Logger) (*Config, error) {
	cfg := &Config{}
	// If the entire config body is empty the UnmarshalYAML method is
	// never called. We thus have to set the DefaultConfig at the entry
	// point as well.
	*cfg = DefaultConfig

	err := yaml.UnmarshalStrict([]byte(s), cfg)
	if err != nil {
		return nil, err
	}

	if !expandExternalLabels {
		return cfg, nil
	}

	for i, v := range cfg.GlobalConfig.ExternalLabels {
		newV := os.Expand(v.Value, func(s string) string {
			if v := os.Getenv(s); v != "" {
				return v
			}
			level.Warn(logger).Log("msg", "Empty environment variable", "name", s)
			return ""
		})
		if newV != v.Value {
			level.Debug(logger).Log("msg", "External label replaced", "label", v.Name, "input", v.Value, "output", newV)
			v.Value = newV
			cfg.GlobalConfig.ExternalLabels[i] = v
		}
	}
	return cfg, nil
}

// LoadFile parses the given YAML file into a Config.
func LoadFile(filename string, expandExternalLabels bool, logger log.Logger) (*Config, error) {
	content, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	cfg, err := Load(string(content), expandExternalLabels, logger)
	if err != nil {
		return nil, errors.Wrapf(err, "parsing YAML file %s", filename)
	}
	cfg.SetDirectory(filepath.Dir(filename))
	return cfg, nil
}

// The defaults applied before parsing the respective config sections.
var (
	// DefaultConfig is the default top-level configuration.
	DefaultConfig = Config{
		GlobalConfig: DefaultGlobalConfig,
	}

	// DefaultGlobalConfig is the default global configuration.
	DefaultGlobalConfig = GlobalConfig{
		ScrapeInterval:     model.Duration(1 * time.Minute),
		ScrapeTimeout:      model.Duration(10 * time.Second),
		EvaluationInterval: model.Duration(1 * time.Minute),
	}

	// DefaultScrapeConfig is the default scrape configuration.
	DefaultScrapeConfig = ScrapeConfig{
		// ScrapeTimeout and ScrapeInterval default to the
		// configured globals.
		MetricsPath:      "/metrics",
		Scheme:           "http",
		HonorLabels:      false,
		HonorTimestamps:  true,
		HTTPClientConfig: config.DefaultHTTPClientConfig,
	}

	// DefaultAlertmanagerConfig is the default alertmanager configuration.
	DefaultAlertmanagerConfig = AlertmanagerConfig{
		Scheme:           "http",
		Timeout:          model.Duration(10 * time.Second),
		APIVersion:       AlertmanagerAPIVersionV2,
		HTTPClientConfig: config.DefaultHTTPClientConfig,
	}

	// DefaultRemoteWriteConfig is the default remote write configuration.
	DefaultRemoteWriteConfig = RemoteWriteConfig{
		RemoteTimeout:    model.Duration(30 * time.Second),
		QueueConfig:      DefaultQueueConfig,
		MetadataConfig:   DefaultMetadataConfig,
		HTTPClientConfig: config.DefaultHTTPClientConfig,
	}

	// DefaultQueueConfig is the default remote queue configuration.
	DefaultQueueConfig = QueueConfig{
		// With a maximum of 200 shards, assuming an average of 100ms remote write
		// time and 500 samples per batch, we will be able to push 1M samples/s.
		MaxShards:         200,
		MinShards:         1,
		MaxSamplesPerSend: 500,

		// Each shard will have a max of 2500 samples pending in its channel, plus the pending
		// samples that have been enqueued. Theoretically we should only ever have about 3000 samples
		// per shard pending. At 200 shards that's 600k.
		Capacity:          2500,
		BatchSendDeadline: model.Duration(5 * time.Second),

		// Backoff times for retrying a batch of samples on recoverable errors.
		MinBackoff: model.Duration(30 * time.Millisecond),
		MaxBackoff: model.Duration(100 * time.Millisecond),
	}

	// DefaultMetadataConfig is the default metadata configuration for a remote write endpoint.
	DefaultMetadataConfig = MetadataConfig{
		Send:              true,
		SendInterval:      model.Duration(1 * time.Minute),
		MaxSamplesPerSend: 500,
	}

	// DefaultRemoteReadConfig is the default remote read configuration.
	DefaultRemoteReadConfig = RemoteReadConfig{
		RemoteTimeout:    model.Duration(1 * time.Minute),
		HTTPClientConfig: config.DefaultHTTPClientConfig,
	}

	// DefaultStorageConfig is the default TSDB/Exemplar storage configuration.
	DefaultStorageConfig = StorageConfig{
		ExemplarsConfig: &DefaultExemplarsConfig,
	}

	DefaultExemplarsConfig = ExemplarsConfig{
		MaxExemplars: 100000,
	}
)

// Config is the top-level configuration for Prometheus's config files.
type Config struct {
	GlobalConfig   GlobalConfig    `yaml:"global"`
	AlertingConfig AlertingConfig  `yaml:"alerting,omitempty"`
	RuleFiles      []string        `yaml:"rule_files,omitempty"`
	ScrapeConfigs  []*ScrapeConfig `yaml:"scrape_configs,omitempty"`
	StorageConfig  StorageConfig   `yaml:"storage,omitempty"`

	RemoteWriteConfigs []*RemoteWriteConfig `yaml:"remote_write,omitempty"`
	RemoteReadConfigs  []*RemoteReadConfig  `yaml:"remote_read,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *Config) SetDirectory(dir string) {
	c.GlobalConfig.SetDirectory(dir)
	c.AlertingConfig.SetDirectory(dir)
	for i, file := range c.RuleFiles {
		c.RuleFiles[i] = config.JoinDir(dir, file)
	}
	for _, c := range c.ScrapeConfigs {
		c.SetDirectory(dir)
	}
	for _, c := range c.RemoteWriteConfigs {
		c.SetDirectory(dir)
	}
	for _, c := range c.RemoteReadConfigs {
		c.SetDirectory(dir)
	}
}

func (c Config) String() string {
	b, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Sprintf("<error creating config string: %s>", err)
	}
	return string(b)
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultConfig
	// We want to set c to the defaults and then overwrite it with the input.
	// To make unmarshal fill the plain data struct rather than calling UnmarshalYAML
	// again, we have to hide it using a type indirection.
	type plain Config
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	// If a global block was open but empty the default global config is overwritten.
	// We have to restore it here.
	if c.GlobalConfig.isZero() {
		c.GlobalConfig = DefaultGlobalConfig
	}

	for _, rf := range c.RuleFiles {
		if !patRulePath.MatchString(rf) {
			return errors.Errorf("invalid rule file path %q", rf)
		}
	}
	// Do global overrides and validate unique names.
	jobNames := map[string]struct{}{}
	for _, scfg := range c.ScrapeConfigs {
		if scfg == nil {
			return errors.New("empty or null scrape config section")
		}
		// First set the correct scrape interval, then check that the timeout
		// (inferred or explicit) is not greater than that.
		if scfg.ScrapeInterval == 0 {
			scfg.ScrapeInterval = c.GlobalConfig.ScrapeInterval
		}
		if scfg.ScrapeTimeout > scfg.ScrapeInterval {
			return errors.Errorf("scrape timeout greater than scrape interval for scrape config with job name %q", scfg.JobName)
		}
		if scfg.ScrapeTimeout == 0 {
			if c.GlobalConfig.ScrapeTimeout > scfg.ScrapeInterval {
				scfg.ScrapeTimeout = scfg.ScrapeInterval
			} else {
				scfg.ScrapeTimeout = c.GlobalConfig.ScrapeTimeout
			}
		}

		if _, ok := jobNames[scfg.JobName]; ok {
			return errors.Errorf("found multiple scrape configs with job name %q", scfg.JobName)
		}
		jobNames[scfg.JobName] = struct{}{}
	}
	rwNames := map[string]struct{}{}
	for _, rwcfg := range c.RemoteWriteConfigs {
		if rwcfg == nil {
			return errors.New("empty or null remote write config section")
		}
		// Skip empty names, we fill their name with their config hash in remote write code.
		if _, ok := rwNames[rwcfg.Name]; ok && rwcfg.Name != "" {
			return errors.Errorf("found multiple remote write configs with job name %q", rwcfg.Name)
		}
		rwNames[rwcfg.Name] = struct{}{}
	}
	rrNames := map[string]struct{}{}
	for _, rrcfg := range c.RemoteReadConfigs {
		if rrcfg == nil {
			return errors.New("empty or null remote read config section")
		}
		// Skip empty names, we fill their name with their config hash in remote read code.
		if _, ok := rrNames[rrcfg.Name]; ok && rrcfg.Name != "" {
			return errors.Errorf("found multiple remote read configs with job name %q", rrcfg.Name)
		}
		rrNames[rrcfg.Name] = struct{}{}
	}
	return nil
}

// GlobalConfig configures values that are used across other configuration
// objects.
type GlobalConfig struct {
	// How frequently to scrape targets by default.
	ScrapeInterval model.Duration `yaml:"scrape_interval,omitempty"`
	// The default timeout when scraping targets.
	ScrapeTimeout model.Duration `yaml:"scrape_timeout,omitempty"`
	// How frequently to evaluate rules by default.
	EvaluationInterval model.Duration `yaml:"evaluation_interval,omitempty"`
	// File to which PromQL queries are logged.
	QueryLogFile string `yaml:"query_log_file,omitempty"`
	// The labels to add to any timeseries that this Prometheus instance scrapes.
	ExternalLabels labels.Labels `yaml:"external_labels,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *GlobalConfig) SetDirectory(dir string) {
	c.QueryLogFile = config.JoinDir(dir, c.QueryLogFile)
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *GlobalConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	// Create a clean global config as the previous one was already populated
	// by the default due to the YAML parser behavior for empty blocks.
	gc := &GlobalConfig{}
	type plain GlobalConfig
	if err := unmarshal((*plain)(gc)); err != nil {
		return err
	}

	for _, l := range gc.ExternalLabels {
		if !model.LabelName(l.Name).IsValid() {
			return errors.Errorf("%q is not a valid label name", l.Name)
		}
		if !model.LabelValue(l.Value).IsValid() {
			return errors.Errorf("%q is not a valid label value", l.Value)
		}
	}

	// First set the correct scrape interval, then check that the timeout
	// (inferred or explicit) is not greater than that.
	if gc.ScrapeInterval == 0 {
		gc.ScrapeInterval = DefaultGlobalConfig.ScrapeInterval
	}
	if gc.ScrapeTimeout > gc.ScrapeInterval {
		return errors.New("global scrape timeout greater than scrape interval")
	}
	if gc.ScrapeTimeout == 0 {
		if DefaultGlobalConfig.ScrapeTimeout > gc.ScrapeInterval {
			gc.ScrapeTimeout = gc.ScrapeInterval
		} else {
			gc.ScrapeTimeout = DefaultGlobalConfig.ScrapeTimeout
		}
	}
	if gc.EvaluationInterval == 0 {
		gc.EvaluationInterval = DefaultGlobalConfig.EvaluationInterval
	}
	*c = *gc
	return nil
}

// isZero returns true iff the global config is the zero value.
func (c *GlobalConfig) isZero() bool {
	return c.ExternalLabels == nil &&
		c.ScrapeInterval == 0 &&
		c.ScrapeTimeout == 0 &&
		c.EvaluationInterval == 0 &&
		c.QueryLogFile == ""
}

// ScrapeConfig configures a scraping unit for Prometheus.
type ScrapeConfig struct {
	// The job name to which the job label is set by default.
	JobName string `yaml:"job_name"`
	// Indicator whether the scraped metrics should remain unmodified.
	HonorLabels bool `yaml:"honor_labels,omitempty"`
	// Indicator whether the scraped timestamps should be respected.
	HonorTimestamps bool `yaml:"honor_timestamps"`
	// A set of query parameters with which the target is scraped.
	Params url.Values `yaml:"params,omitempty"`
	// How frequently to scrape the targets of this scrape config.
	ScrapeInterval model.Duration `yaml:"scrape_interval,omitempty"`
	// The timeout for scraping targets of this config.
	ScrapeTimeout model.Duration `yaml:"scrape_timeout,omitempty"`
	// The HTTP resource path on which to fetch metrics from targets.
	MetricsPath string `yaml:"metrics_path,omitempty"`
	// The URL scheme with which to fetch metrics from targets.
	Scheme string `yaml:"scheme,omitempty"`
	// An uncompressed response body larger than this many bytes will cause the
	// scrape to fail. 0 means no limit.
	BodySizeLimit units.Base2Bytes `yaml:"body_size_limit,omitempty"`
	// More than this many samples post metric-relabeling will cause the scrape to
	// fail.
	SampleLimit uint `yaml:"sample_limit,omitempty"`
	// More than this many targets after the target relabeling will cause the
	// scrapes to fail.
	TargetLimit uint `yaml:"target_limit,omitempty"`
	// More than this many labels post metric-relabeling will cause the scrape to
	// fail.
	LabelLimit uint `yaml:"label_limit,omitempty"`
	// More than this label name length post metric-relabeling will cause the
	// scrape to fail.
	LabelNameLengthLimit uint `yaml:"label_name_length_limit,omitempty"`
	// More than this label value length post metric-relabeling will cause the
	// scrape to fail.
	LabelValueLengthLimit uint `yaml:"label_value_length_limit,omitempty"`

	// We cannot do proper Go type embedding below as the parser will then parse
	// values arbitrarily into the overflow maps of further-down types.

	ServiceDiscoveryConfigs discovery.Configs       `yaml:"-"`
	HTTPClientConfig        config.HTTPClientConfig `yaml:",inline"`

	// List of target relabel configurations.
	RelabelConfigs []*relabel.Config `yaml:"relabel_configs,omitempty"`
	// List of metric relabel configurations.
	MetricRelabelConfigs []*relabel.Config `yaml:"metric_relabel_configs,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *ScrapeConfig) SetDirectory(dir string) {
	c.ServiceDiscoveryConfigs.SetDirectory(dir)
	c.HTTPClientConfig.SetDirectory(dir)
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *ScrapeConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultScrapeConfig
	if err := discovery.UnmarshalYAMLWithInlineConfigs(c, unmarshal); err != nil {
		return err
	}
	if len(c.JobName) == 0 {
		return errors.New("job_name is empty")
	}

	// The UnmarshalYAML method of HTTPClientConfig is not being called because it's not a pointer.
	// We cannot make it a pointer as the parser panics for inlined pointer structs.
	// Thus we just do its validation here.
	if err := c.HTTPClientConfig.Validate(); err != nil {
		return err
	}

	// Check for users putting URLs in target groups.
	if len(c.RelabelConfigs) == 0 {
		if err := checkStaticTargets(c.ServiceDiscoveryConfigs); err != nil {
			return err
		}
	}

	for _, rlcfg := range c.RelabelConfigs {
		if rlcfg == nil {
			return errors.New("empty or null target relabeling rule in scrape config")
		}
	}
	for _, rlcfg := range c.MetricRelabelConfigs {
		if rlcfg == nil {
			return errors.New("empty or null metric relabeling rule in scrape config")
		}
	}

	return nil
}

// MarshalYAML implements the yaml.Marshaler interface.
func (c *ScrapeConfig) MarshalYAML() (interface{}, error) {
	return discovery.MarshalYAMLWithInlineConfigs(c)
}

// StorageConfig configures runtime reloadable configuration options.
type StorageConfig struct {
	ExemplarsConfig *ExemplarsConfig `yaml:"exemplars,omitempty"`
}

// ExemplarsConfig configures runtime reloadable configuration options.
type ExemplarsConfig struct {
	// MaxExemplars sets the size, in # of exemplars stored, of the single circular buffer used to store exemplars in memory.
	// Use a value of 0 or less than 0 to disable the storage without having to restart Prometheus.
	MaxExemplars int64 `yaml:"max_exemplars,omitempty"`
}

// AlertingConfig configures alerting and alertmanager related configs.
type AlertingConfig struct {
	AlertRelabelConfigs []*relabel.Config   `yaml:"alert_relabel_configs,omitempty"`
	AlertmanagerConfigs AlertmanagerConfigs `yaml:"alertmanagers,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *AlertingConfig) SetDirectory(dir string) {
	for _, c := range c.AlertmanagerConfigs {
		c.SetDirectory(dir)
	}
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *AlertingConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	// Create a clean global config as the previous one was already populated
	// by the default due to the YAML parser behavior for empty blocks.
	*c = AlertingConfig{}
	type plain AlertingConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}

	for _, rlcfg := range c.AlertRelabelConfigs {
		if rlcfg == nil {
			return errors.New("empty or null alert relabeling rule")
		}
	}
	return nil
}

// AlertmanagerConfigs is a slice of *AlertmanagerConfig.
type AlertmanagerConfigs []*AlertmanagerConfig

// ToMap converts a slice of *AlertmanagerConfig to a map.
func (a AlertmanagerConfigs) ToMap() map[string]*AlertmanagerConfig {
	ret := make(map[string]*AlertmanagerConfig)
	for i := range a {
		ret[fmt.Sprintf("config-%d", i)] = a[i]
	}
	return ret
}

// AlertmanagerAPIVersion represents a version of the
// github.com/prometheus/alertmanager/api, e.g. 'v1' or 'v2'.
type AlertmanagerAPIVersion string

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (v *AlertmanagerAPIVersion) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*v = AlertmanagerAPIVersion("")
	type plain AlertmanagerAPIVersion
	if err := unmarshal((*plain)(v)); err != nil {
		return err
	}

	for _, supportedVersion := range SupportedAlertmanagerAPIVersions {
		if *v == supportedVersion {
			return nil
		}
	}

	return fmt.Errorf("expected Alertmanager api version to be one of %v but got %v", SupportedAlertmanagerAPIVersions, *v)
}

const (
	// AlertmanagerAPIVersionV1 represents
	// github.com/prometheus/alertmanager/api/v1.
	AlertmanagerAPIVersionV1 AlertmanagerAPIVersion = "v1"
	// AlertmanagerAPIVersionV2 represents
	// github.com/prometheus/alertmanager/api/v2.
	AlertmanagerAPIVersionV2 AlertmanagerAPIVersion = "v2"
)

var SupportedAlertmanagerAPIVersions = []AlertmanagerAPIVersion{
	AlertmanagerAPIVersionV1, AlertmanagerAPIVersionV2,
}

// AlertmanagerConfig configures how Alertmanagers can be discovered and communicated with.
type AlertmanagerConfig struct {
	// We cannot do proper Go type embedding below as the parser will then parse
	// values arbitrarily into the overflow maps of further-down types.

	ServiceDiscoveryConfigs discovery.Configs       `yaml:"-"`
	HTTPClientConfig        config.HTTPClientConfig `yaml:",inline"`

	// Info: change in fork
	// HTTP header fields for the HTTP Request to this Alertmanager
	Headers map[string]string

	// The URL scheme to use when talking to Alertmanagers.
	Scheme string `yaml:"scheme,omitempty"`
	// Path prefix to add in front of the push endpoint path.
	PathPrefix string `yaml:"path_prefix,omitempty"`
	// The timeout used when sending alerts.
	Timeout model.Duration `yaml:"timeout,omitempty"`

	// The api version of Alertmanager.
	APIVersion AlertmanagerAPIVersion `yaml:"api_version"`

	// List of Alertmanager relabel configurations.
	RelabelConfigs []*relabel.Config `yaml:"relabel_configs,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *AlertmanagerConfig) SetDirectory(dir string) {
	c.ServiceDiscoveryConfigs.SetDirectory(dir)
	c.HTTPClientConfig.SetDirectory(dir)
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *AlertmanagerConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultAlertmanagerConfig
	if err := discovery.UnmarshalYAMLWithInlineConfigs(c, unmarshal); err != nil {
		return err
	}

	// The UnmarshalYAML method of HTTPClientConfig is not being called because it's not a pointer.
	// We cannot make it a pointer as the parser panics for inlined pointer structs.
	// Thus we just do its validation here.
	if err := c.HTTPClientConfig.Validate(); err != nil {
		return err
	}

	// Check for users putting URLs in target groups.
	if len(c.RelabelConfigs) == 0 {
		if err := checkStaticTargets(c.ServiceDiscoveryConfigs); err != nil {
			return err
		}
	}

	for _, rlcfg := range c.RelabelConfigs {
		if rlcfg == nil {
			return errors.New("empty or null Alertmanager target relabeling rule")
		}
	}

	return nil
}

// MarshalYAML implements the yaml.Marshaler interface.
func (c *AlertmanagerConfig) MarshalYAML() (interface{}, error) {
	return discovery.MarshalYAMLWithInlineConfigs(c)
}

func checkStaticTargets(configs discovery.Configs) error {
	for _, cfg := range configs {
		sc, ok := cfg.(discovery.StaticConfig)
		if !ok {
			continue
		}
		for _, tg := range sc {
			for _, t := range tg.Targets {
				if err := CheckTargetAddress(t[model.AddressLabel]); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// CheckTargetAddress checks if target address is valid.
func CheckTargetAddress(address model.LabelValue) error {
	// For now check for a URL, we may want to expand this later.
	if strings.Contains(string(address), "/") {
		return errors.Errorf("%q is not a valid hostname", address)
	}
	return nil
}

// RemoteWriteConfig is the configuration for writing to remote storage.
type RemoteWriteConfig struct {
	URL                 *config.URL       `yaml:"url"`
	RemoteTimeout       model.Duration    `yaml:"remote_timeout,omitempty"`
	Headers             map[string]string `yaml:"headers,omitempty"`
	WriteRelabelConfigs []*relabel.Config `yaml:"write_relabel_configs,omitempty"`
	Name                string            `yaml:"name,omitempty"`
	SendExemplars       bool              `yaml:"send_exemplars,omitempty"`

	// We cannot do proper Go type embedding below as the parser will then parse
	// values arbitrarily into the overflow maps of further-down types.
	HTTPClientConfig config.HTTPClientConfig `yaml:",inline"`
	QueueConfig      QueueConfig             `yaml:"queue_config,omitempty"`
	MetadataConfig   MetadataConfig          `yaml:"metadata_config,omitempty"`
	SigV4Config      *sigv4.SigV4Config      `yaml:"sigv4,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *RemoteWriteConfig) SetDirectory(dir string) {
	c.HTTPClientConfig.SetDirectory(dir)
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *RemoteWriteConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultRemoteWriteConfig
	type plain RemoteWriteConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.URL == nil {
		return errors.New("url for remote_write is empty")
	}
	for _, rlcfg := range c.WriteRelabelConfigs {
		if rlcfg == nil {
			return errors.New("empty or null relabeling rule in remote write config")
		}
	}
	if err := validateHeaders(c.Headers); err != nil {
		return err
	}

	// The UnmarshalYAML method of HTTPClientConfig is not being called because it's not a pointer.
	// We cannot make it a pointer as the parser panics for inlined pointer structs.
	// Thus we just do its validation here.
	if err := c.HTTPClientConfig.Validate(); err != nil {
		return err
	}

	httpClientConfigAuthEnabled := c.HTTPClientConfig.BasicAuth != nil ||
		c.HTTPClientConfig.Authorization != nil || c.HTTPClientConfig.OAuth2 != nil

	if httpClientConfigAuthEnabled && c.SigV4Config != nil {
		return fmt.Errorf("at most one of basic_auth, authorization, oauth2, & sigv4 must be configured")
	}

	return nil
}

func validateHeaders(headers map[string]string) error {
	for header := range headers {
		if strings.ToLower(header) == "authorization" {
			return errors.New("authorization header must be changed via the basic_auth, authorization, oauth2, or sigv4 parameter")
		}
		if _, ok := reservedHeaders[strings.ToLower(header)]; ok {
			return errors.Errorf("%s is a reserved header. It must not be changed", header)
		}
	}
	return nil
}

// QueueConfig is the configuration for the queue used to write to remote
// storage.
type QueueConfig struct {
	// Number of samples to buffer per shard before we block. Defaults to
	// MaxSamplesPerSend.
	Capacity int `yaml:"capacity,omitempty"`

	// Max number of shards, i.e. amount of concurrency.
	MaxShards int `yaml:"max_shards,omitempty"`

	// Min number of shards, i.e. amount of concurrency.
	MinShards int `yaml:"min_shards,omitempty"`

	// Maximum number of samples per send.
	MaxSamplesPerSend int `yaml:"max_samples_per_send,omitempty"`

	// Maximum time sample will wait in buffer.
	BatchSendDeadline model.Duration `yaml:"batch_send_deadline,omitempty"`

	// On recoverable errors, backoff exponentially.
	MinBackoff       model.Duration `yaml:"min_backoff,omitempty"`
	MaxBackoff       model.Duration `yaml:"max_backoff,omitempty"`
	RetryOnRateLimit bool           `yaml:"retry_on_http_429,omitempty"`
}

// MetadataConfig is the configuration for sending metadata to remote
// storage.
type MetadataConfig struct {
	// Send controls whether we send metric metadata to remote storage.
	Send bool `yaml:"send"`
	// SendInterval controls how frequently we send metric metadata.
	SendInterval model.Duration `yaml:"send_interval"`
	// Maximum number of samples per send.
	MaxSamplesPerSend int `yaml:"max_samples_per_send,omitempty"`
}

// RemoteReadConfig is the configuration for reading from remote storage.
type RemoteReadConfig struct {
	URL           *config.URL       `yaml:"url"`
	RemoteTimeout model.Duration    `yaml:"remote_timeout,omitempty"`
	Headers       map[string]string `yaml:"headers,omitempty"`
	ReadRecent    bool              `yaml:"read_recent,omitempty"`
	Name          string            `yaml:"name,omitempty"`

	// We cannot do proper Go type embedding below as the parser will then parse
	// values arbitrarily into the overflow maps of further-down types.
	HTTPClientConfig config.HTTPClientConfig `yaml:",inline"`

	// RequiredMatchers is an optional list of equality matchers which have to
	// be present in a selector to query the remote read endpoint.
	RequiredMatchers model.LabelSet `yaml:"required_matchers,omitempty"`
}

// SetDirectory joins any relative file paths with dir.
func (c *RemoteReadConfig) SetDirectory(dir string) {
	c.HTTPClientConfig.SetDirectory(dir)
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *RemoteReadConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	*c = DefaultRemoteReadConfig
	type plain RemoteReadConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	if c.URL == nil {
		return errors.New("url for remote_read is empty")
	}
	if err := validateHeaders(c.Headers); err != nil {
		return err
	}
	// The UnmarshalYAML method of HTTPClientConfig is not being called because it's not a pointer.
	// We cannot make it a pointer as the parser panics for inlined pointer structs.
	// Thus we just do its validation here.
	return c.HTTPClientConfig.Validate()
}
