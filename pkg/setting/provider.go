package setting

import (
	"errors"
	"strings"
	"time"

	"gopkg.in/ini.v1"
)

var (
	ErrOperationNotPermitted = errors.New("operation not permitted")
)

type ValidationError struct {
	Errors []error
}

func (v ValidationError) Error() string {
	builder := strings.Builder{}

	for i, e := range v.Errors {
		builder.WriteString(e.Error())
		if i != len(v.Errors)-1 {
			builder.WriteString(", ")
		}
	}

	return builder.String()
}

// Provider is a settings provider abstraction
// with thread-safety and runtime updates.
type Provider interface {
	// Current returns a SettingsBag with a static copy of
	// the current configured pairs of key/values for each
	// configuration section.
	Current() SettingsBag

	CurrentVerbose() VerboseSettingsBag

	// Update receives a SettingsBag with the pairs of key/values
	// to be updated per section and a SettingsRemovals with the
	// section keys to be removed.
	Update(updates SettingsBag, removals SettingsRemovals) error
	// KeyValue returns a key-value abstraction
	// for the given pair of section and key.
	KeyValue(section, key string) KeyValue
	// Section returns a settings section
	// abstraction for the given section name.
	Section(section string) Section
	// RegisterReloadHandler registers a handler for validation and reload
	// of configuration updates tied to a specific section
	RegisterReloadHandler(section string, handler ReloadHandler)
}

// Section is a settings section copy
// with all of its pairs of keys-values.
type Section interface {
	// KeyValue returns a key-value
	// abstraction for the given key.
	KeyValue(key string) KeyValue
}

// KeyValue represents a settings key-value
// for a given pair of section and key.
type KeyValue interface {
	// Key returns pair's key.
	Key() string
	// Value returns pair's value.
	Value() string

	// MustString returns the value's string representation
	// If empty, then it returns the given default.
	MustString(defaultVal string) string
	// MustBool returns the value's boolean representation
	// Otherwise returns the given default.
	MustBool(defaultVal bool) bool
	// MustDuration returns the value's time.Duration
	// representation. Otherwise returns the given default.
	MustDuration(defaultVal time.Duration) time.Duration
}

// ReloadHandler defines the expected behaviour from a
// service that have support for configuration reloads.
type ReloadHandler interface {
	// Reload handles reloading of configuration changes.
	Reload(section Section) error

	// Validate validates the configuration, if the validation
	// fails the configuration will not be updated neither reloaded.
	Validate(section Section) error
}

type SettingsBag map[string]map[string]string
type VerboseSettingsBag map[string]SettingsBag
type SettingsRemovals map[string][]string

const (
	Value string = "value"
)

func ProvideProvider(cfg *Cfg) *OSSImpl {
	return &OSSImpl{
		Cfg: cfg,
	}
}

type OSSImpl struct {
	Cfg *Cfg
}

func (o OSSImpl) Current() SettingsBag {
	settingsCopy := make(SettingsBag)

	for _, section := range o.Cfg.Raw.Sections() {
		settingsCopy[section.Name()] = make(map[string]string)
		for _, key := range section.Keys() {
			settingsCopy[section.Name()][key.Name()] = RedactedValue(EnvKey(section.Name(), key.Name()), key.Value())
		}
	}

	return settingsCopy
}

func (o OSSImpl) CurrentVerbose() VerboseSettingsBag {
	settingsCopy := make(VerboseSettingsBag)

	for _, section := range o.Cfg.Raw.Sections() {
		settingsCopy[section.Name()] = make(map[string]map[string]string)
		for _, key := range section.Keys() {
			settingsCopy[section.Name()][key.Name()] = make(map[string]string)
			settingsCopy[section.Name()][key.Name()][Value] = RedactedValue(EnvKey(section.Name(), key.Name()), key.Value())
		}
	}

	return settingsCopy
}

func (OSSImpl) Update(SettingsBag, SettingsRemovals) error {
	return errors.New("oss settings provider do not have support for settings updates")
}

func (o *OSSImpl) KeyValue(section, key string) KeyValue {
	return o.Section(section).KeyValue(key)
}

func (o *OSSImpl) Section(section string) Section {
	return &sectionImpl{section: o.Cfg.Raw.Section(section)}
}

func (OSSImpl) RegisterReloadHandler(string, ReloadHandler) {}

func (o OSSImpl) IsFeatureToggleEnabled(name string) bool {
	return o.Cfg.IsFeatureToggleEnabled(name)
}

type keyValImpl struct {
	key *ini.Key
}

func (k *keyValImpl) Key() string {
	return k.key.Name()
}

func (k *keyValImpl) Value() string {
	return k.key.Value()
}

func (k *keyValImpl) MustString(defaultVal string) string {
	return k.key.MustString(defaultVal)
}

func (k *keyValImpl) MustBool(defaultVal bool) bool {
	return k.key.MustBool(defaultVal)
}

func (k *keyValImpl) MustDuration(defaultVal time.Duration) time.Duration {
	return k.key.MustDuration(defaultVal)
}

type sectionImpl struct {
	section *ini.Section
}

func (s *sectionImpl) KeyValue(key string) KeyValue {
	return &keyValImpl{s.section.Key(key)}
}
