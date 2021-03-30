package settingsprovider

import (
	"reflect"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("settingsprovider")
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "SettingsProvider",
		Instance:     &Implementation{},
		InitPriority: registry.High - 5,
	})
}

type settingsBag map[string]map[string]string

type Implementation struct {
	sync.RWMutex
	FileCfg        *setting.Cfg       `inject:""`
	SQLStore       *sqlstore.SQLStore `inject:""`
	settings       settingsBag
	reloadHandlers map[string][]settings.ReloadHandler
}

func (i *Implementation) Init() (err error) {
	i.settings, err = i.loadAndMergeSettings()
	i.reloadHandlers = map[string][]settings.ReloadHandler{}
	if err != nil {
		return err
	}

	go func() {
		syncTicker := time.NewTicker(1 * time.Minute)
		for {
			<-syncTicker.C
			logger.Debug("Checking for updates")

			err := i.Refresh()
			if err != nil {
				logger.Error("Error while refreshing settings", "error", err.Error())
			}
		}
	}()

	return
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

func (i *Implementation) Refresh() error {
	newSettingsBag, err := i.loadAndMergeSettings()
	if err != nil {
		return err
	}

	i.RLock()
	toReload := map[string]map[string]string{}

	// still does not cover config that exists in the old settings but not in the new
	// will this reload settings from the filesystem too, and do we want that?
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

	i.Lock()
	i.settings = newSettingsBag
	i.Unlock()

	i.triggerReload(toReload)

	return nil
}

func (i *Implementation) triggerFullReload() {
	for section, handlers := range i.reloadHandlers {
		for _, h := range handlers {
			h.Reload(i.Section(section))
		}
	}
}

func (i *Implementation) triggerReload(bag settingsBag) {
	for sectionName, config := range bag {
		if handlers, exists := i.reloadHandlers[sectionName]; exists {
			logger.Debug("Reloading services using", "section", sectionName)
			for _, h := range handlers {
				h.Reload(buildSection(config))
			}
		}
	}
}

func (i *Implementation) RegisterReloadHandler(section string, h settings.ReloadHandler) {
	i.RLock()
	defer i.RUnlock()

	handlers := i.reloadHandlers[section]
	handlers = append(handlers, h)
	i.reloadHandlers[section] = handlers
}

func (i *Implementation) loadAndMergeSettings() (settingsBag, error) {
	bag := make(settingsBag)

	// Settings from INI file
	for _, section := range i.FileCfg.Raw.Sections() {
		bag[section.Name()] = make(map[string]string)

		for _, key := range section.Keys() {
			bag[section.Name()][key.Name()] = key.Value()
		}
	}

	// Settings from database
	dbSettings, err := i.SQLStore.GetSettings()
	if err != nil {
		return nil, err
	}

	for _, dbSetting := range dbSettings {
		_, ok := bag[dbSetting.Section]
		if !ok {
			bag[dbSetting.Section] = make(map[string]string)
		}

		bag[dbSetting.Section][dbSetting.Key] = dbSetting.Value
	}

	return bag, nil
}
