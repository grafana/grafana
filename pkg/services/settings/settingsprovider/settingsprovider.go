package settingsprovider

import (
	"fmt"
	"reflect"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("settingsprovider")

// updateRegexpRules defines a set of rules
// used to validate which settings can be
// updated through the exposed settings API.
var updateRegexpRules = []string{
	`auth\.saml\..*`,
	`security\.encryption\.algorithm`,
}

// Binds to OSS [setting.Provider]
type Implementation struct {
	sync.RWMutex
	FileCfg         *setting.Cfg
	RouteRegister   routing.RouteRegister
	AccessControl   accesscontrol.AccessControl
	db              store
	settings        setting.SettingsBag
	verboseSettings setting.VerboseSettingsBag
	reloadHandlers  map[string][]setting.ReloadHandler
	features        featuremgmt.FeatureToggles
}

func ProvideService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db db.DB, routeRegister routing.RouteRegister,
	accessControl accesscontrol.AccessControl, accesscontrolService accesscontrol.Service) (*Implementation, error) {
	s := &Implementation{
		FileCfg:        cfg,
		RouteRegister:  routeRegister,
		AccessControl:  accessControl,
		db:             &database{db: db},
		reloadHandlers: map[string][]setting.ReloadHandler{},
		features:       features,
	}

	if err := s.init(); err != nil {
		return nil, err
	}

	if err := settings.DeclareFixedRoles(accesscontrolService); err != nil {
		return nil, err
	}

	return s, nil
}

func (i *Implementation) init() (err error) {
	i.settings, i.verboseSettings, err = loadAndMergeSettings(i.FileCfg, i.db, setting.SettingsRemovals{})
	if err != nil {
		return err
	}

	go func() {
		syncTicker := time.NewTicker(1 * time.Minute)
		for {
			<-syncTicker.C
			logger.Debug("Checking for updates")

			err := i.refresh()
			if err != nil {
				logger.Error("Error while refreshing settings", "error", err.Error())
			}
		}
	}()

	i.registerEndpoints()

	return
}

func (i *Implementation) Current() setting.SettingsBag {
	settingsCopy := make(setting.SettingsBag)

	for section, pairs := range i.settings {
		settingsCopy[section] = make(map[string]string)
		for key, value := range pairs {
			settingsCopy[section][key] = setting.RedactedValue(setting.EnvKey(section, key), value)
		}
	}

	return settingsCopy
}

func (i *Implementation) CurrentVerbose() setting.VerboseSettingsBag {
	verboseSettingsCopy := make(setting.VerboseSettingsBag)
	for section, pairs := range i.verboseSettings {
		verboseSettingsCopy[section] = make(map[string]map[setting.VerboseSourceType]string)
		for key, values := range pairs {
			verboseSettingsCopy[section][key] = make(map[setting.VerboseSourceType]string)
			verboseSettingsCopy[section][key][setting.DB] = setting.RedactedValue(setting.EnvKey(section, key), values[setting.DB])
			verboseSettingsCopy[section][key][setting.System] = setting.RedactedValue(setting.EnvKey(section, key), values[setting.System])
		}
	}
	return verboseSettingsCopy
}

func (i *Implementation) Update(updates setting.SettingsBag, removals setting.SettingsRemovals) error {
	if err := i.validateUpdate(updates); err != nil {
		return err
	}

	if err := i.refreshWithBag(updates, removals); err != nil {
		return err
	}

	return nil
}

func (i *Implementation) validateUpdate(changes setting.SettingsBag) error {
	for section, keyvalues := range changes {
		for key := range keyvalues {
			if !i.isPermitted(section, key) {
				return fmt.Errorf(
					"section: %s, key: %s - %w",
					section, key, setting.ErrOperationNotPermitted,
				)
			}
		}
	}

	return nil
}

func (i *Implementation) isPermitted(section, key string) bool {
	for _, rule := range updateRegexpRules {
		sectionKey := fmt.Sprintf("%s.%s", section, key)

		match, err := regexp.MatchString(rule, sectionKey)
		if err == nil && match {
			return true
		}
	}
	return false
}

func (i *Implementation) Section(name string) setting.Section {
	return passthroughSection{name, i}
}

func (i *Implementation) KeyValue(section, key string) setting.KeyValue {
	i.RLock()
	defer i.RUnlock()

	emptyKV := keyValue{key: key, value: ""}

	_, ok := i.settings[section]
	if !ok {
		return emptyKV
	}

	value, ok := i.settings[section][key]
	if !ok {
		return emptyKV
	}

	return keyValue{key: key, value: value}
}

func (i *Implementation) refresh() error {
	return i.refreshWithBag(nil, nil)
}

func (i *Implementation) refreshWithBag(updates setting.SettingsBag, removals setting.SettingsRemovals) error {
	i.Lock()
	defer i.Unlock()

	newSettingsBag, _, err := loadAndMergeSettings(i.FileCfg, i.db, removals)
	if err != nil {
		return err
	}

	for section, keyvalues := range updates {
		for key, value := range keyvalues {
			if _, ok := newSettingsBag[section]; !ok {
				newSettingsBag[section] = make(map[string]string)
			}

			newSettingsBag[section][key] = value
		}
	}

	toReload := map[string]map[string]string{}

	// Looking for settings present at newSettingsBag
	// that previously didn't exist or that has changed.
	for sectionName, newSettings := range newSettingsBag {
		oldConfig, exists := i.settings[sectionName]

		if !(exists && reflect.DeepEqual(newSettings, oldConfig)) {
			logger.Debug("Settings have changed", "section", sectionName)
			toReload[sectionName] = newSettings
		}
	}

	// Looking for settings present at old settings
	// that are no longer present.
	for sectionName := range i.settings {
		_, exists := newSettingsBag[sectionName]

		if !exists {
			logger.Debug("Settings have been removed", "section", sectionName)
			toReload[sectionName] = make(map[string]string)
		}
	}

	// 1. Validate settings
	if err = i.validateSettings(toReload); err != nil {
		return err
	}

	// 2 Store settings in database
	err = i.db.UpsertSettings(updates, removals)
	if err != nil {
		return err
	}

	// 3 Replace in-memory settings
	i.settings = newSettingsBag

	// 4. Reload services
	if err = i.triggerReload(toReload); err != nil {
		return err
	}

	return nil
}

func (i *Implementation) validateSettings(bag setting.SettingsBag) error {
	logger.Debug("Validating settings updates")
	return i.handleReloadable("Validating", bag, func(handler setting.ReloadHandler, section setting.Section) error {
		err := handler.Validate(section)
		if err != nil {
			logger.Error("Settings updates validation failed", "error", err)
			return err
		}

		return nil
	})
}

func (i *Implementation) triggerReload(bag setting.SettingsBag) error {
	logger.Debug("Reloading settings")
	return i.handleReloadable("Reloading", bag, func(handler setting.ReloadHandler, section setting.Section) error {
		err := handler.Reload(section)
		if err != nil {
			logger.Error("Settings updates reload failed", "error", err)
			return err
		}

		return nil
	})
}

func (i *Implementation) handleReloadable(action string, bag setting.SettingsBag, handler func(handler setting.ReloadHandler, section setting.Section) error) error {
	var handleErrors []error

	for sectionName, config := range bag {
		if handlers, exists := i.reloadHandlers[sectionName]; exists {
			logger.Debug(action, "section", sectionName)
			for _, h := range handlers {
				if err := handler(h, buildSection(config)); err != nil {
					handleErrors = append(handleErrors, fmt.Errorf("%s: %w", sectionName, err))
				}
			}
		}
	}

	if len(handleErrors) > 0 {
		return setting.ValidationError{Errors: handleErrors}
	}

	return nil
}

func (i *Implementation) RegisterReloadHandler(section string, h setting.ReloadHandler) {
	i.Lock()
	defer i.Unlock()

	handlers := i.reloadHandlers[section]
	handlers = append(handlers, h)
	i.reloadHandlers[section] = handlers
}

func loadAndMergeSettings(cfg *setting.Cfg, db store, removals setting.SettingsRemovals) (setting.SettingsBag, setting.VerboseSettingsBag, error) {
	bag := make(setting.SettingsBag)
	vsb := make(setting.VerboseSettingsBag)

	// Inherited settings, it includes:
	// - INI configuration file
	// - Command-line arguments
	// - Environment variables
	// - Variable expansion (i.e. Vault)
	for _, section := range cfg.Raw.Sections() {
		bag[section.Name()] = make(map[string]string)
		vsb[section.Name()] = make(map[string]map[setting.VerboseSourceType]string)

		for _, key := range section.Keys() {
			bag[section.Name()][key.Name()] = key.Value()
			vsb[section.Name()][key.Name()] = make(map[setting.VerboseSourceType]string)
			vsb[section.Name()][key.Name()][setting.System] = key.Value()
		}
	}

	// Settings from database
	dbSettings, err := db.GetSettings()
	if err != nil {
		return nil, nil, err
	}

	unsetDbSettings := map[string]struct{}{}
	for sec, secRem := range removals {
		for _, key := range secRem {
			unsetDbSettings[sec+key] = struct{}{}
		}
	}

	for _, dbSetting := range dbSettings {
		// Don't load settings that are going to be removed from the db
		if _, exists := unsetDbSettings[dbSetting.Section+dbSetting.Key]; exists {
			continue
		}

		if _, ok := bag[dbSetting.Section]; !ok {
			bag[dbSetting.Section] = make(map[string]string)
		}

		if _, ok := vsb[dbSetting.Section]; !ok {
			vsb[dbSetting.Section] = make(map[string]map[setting.VerboseSourceType]string)
		}

		if _, ok := vsb[dbSetting.Section][dbSetting.Key]; !ok {
			vsb[dbSetting.Section][dbSetting.Key] = make(map[setting.VerboseSourceType]string)
		}

		bag[dbSetting.Section][dbSetting.Key] = dbSetting.Value
		vsb[dbSetting.Section][dbSetting.Key][setting.DB] = dbSetting.Value
	}

	return bag, vsb, nil
}

// TODO: does not support settings in database yet
func (i *Implementation) IsFeatureToggleEnabled(name string) bool {
	return i.features.IsEnabled(name)
}
