package settingsprovider

import (
	"fmt"
	"reflect"
	"regexp"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("settingsprovider")

// updateRegexpRules defines a set of rules
// used to validate which settings can be
// updated through the exposed settings API.
var updateRegexpRules = []string{
	`auth.saml..*`,
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "SettingsProvider",
		Instance:     &Implementation{},
		InitPriority: registry.High - 5,
	})
}

type Implementation struct {
	sync.RWMutex
	FileCfg        *setting.Cfg       `inject:""`
	SQLStore       *sqlstore.SQLStore `inject:""`
	db             *database
	settings       settings.SettingsBag
	reloadHandlers map[string][]settings.ReloadHandler
}

func (i *Implementation) Init() (err error) {
	i.db = &database{SQLStore: i.SQLStore}
	i.settings, err = i.loadAndMergeSettings(settings.SettingsRemovals{})
	i.reloadHandlers = map[string][]settings.ReloadHandler{}
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

	return
}

func (i *Implementation) Update(updates settings.SettingsBag, removals settings.SettingsRemovals) error {
	if err := i.validateUpdate(updates); err != nil {
		return err
	}

	if err := i.refreshWithBag(updates, removals); err != nil {
		return err
	}

	return nil
}

func (i *Implementation) validateUpdate(changes settings.SettingsBag) error {
	for section, keyvalues := range changes {
		for key := range keyvalues {
			if !i.isPermitted(section, key) {
				return fmt.Errorf(
					"section: %s, key: %s - %w",
					section, key, settings.ErrOperationNotPermitted,
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

func (i *Implementation) Section(name string) settings.Section {
	return passthroughSection{name, i}
}

func (i *Implementation) KeyValue(section, key string) settings.KeyValue {
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

func (i *Implementation) refreshWithBag(updates settings.SettingsBag, removals settings.SettingsRemovals) error {
	newSettingsBag, err := i.loadAndMergeSettings(removals)
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

	i.RLock()
	toReload := map[string]map[string]string{}

	for sectionName, newSettings := range newSettingsBag {
		oldConfig, exists := i.settings[sectionName]

		if !(exists && reflect.DeepEqual(newSettings, oldConfig)) {
			logger.Debug("Settings have changed", "section", sectionName)
			toReload[sectionName] = newSettings
		}
	}

	i.RUnlock()

	if len(toReload) == 0 {
		return nil
	}

	// 1. Validate settings
	if err = i.validateSettings(toReload); err != nil {
		return err
	}

	// 2. Store settings in DB and memory
	i.Lock()
	err = i.db.UpsertSettings(updates, removals)
	if err != nil {
		return err
	}
	i.settings = newSettingsBag
	i.Unlock()

	// 3. Reload services
	if err = i.triggerReload(toReload); err != nil {
		return err
	}

	return nil
}

func (i *Implementation) validateSettings(bag settings.SettingsBag) error {
	logger.Debug("Validating settings updates")
	return i.handleReloadable("Validating", bag, func(handler settings.ReloadHandler, section settings.Section) error {
		return handler.Validate(section)
	})
}

func (i *Implementation) triggerReload(bag settings.SettingsBag) error {
	logger.Debug("Reloading settings")
	return i.handleReloadable("Reloading", bag, func(handler settings.ReloadHandler, section settings.Section) error {
		return handler.Reload(section)
	})
}

func (i *Implementation) handleReloadable(action string, bag settings.SettingsBag, handler func(handler settings.ReloadHandler, section settings.Section) error) error {
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
		return settings.ValidationError{Errors: handleErrors}
	}

	return nil
}

func (i *Implementation) RegisterReloadHandler(section string, h settings.ReloadHandler) {
	i.RLock()
	defer i.RUnlock()

	handlers := i.reloadHandlers[section]
	handlers = append(handlers, h)
	i.reloadHandlers[section] = handlers
}

func (i *Implementation) loadAndMergeSettings(removals settings.SettingsRemovals) (settings.SettingsBag, error) {
	bag := make(settings.SettingsBag)

	// Settings from INI file
	for _, section := range i.FileCfg.Raw.Sections() {
		bag[section.Name()] = make(map[string]string)

		for _, key := range section.Keys() {
			bag[section.Name()][key.Name()] = key.Value()
		}
	}

	// Settings from database
	dbSettings, err := i.db.GetSettings()
	if err != nil {
		return nil, err
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

		bag[dbSetting.Section][dbSetting.Key] = dbSetting.Value
	}

	return bag, nil
}
