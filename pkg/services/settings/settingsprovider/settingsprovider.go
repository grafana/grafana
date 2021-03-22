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
	FileCfg  *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
	settings settingsBag
}

func (i *Implementation) Init() (err error) {
	i.settings, err = i.loadAndMergeSettings()
	if err != nil {
		return err
	}

	go func() {
		syncTicker := time.NewTicker(1 * time.Minute)
		for {
			<-syncTicker.C
			logger.Info("Checking for new updates")

			err := i.Refresh()
			if err != nil {
				logger.Error("Error while refreshing settings", "error", err.Error())
			}
		}
	}()

	return
}

func (i *Implementation) Section(name string) settings.Section {
	i.RLock()
	defer i.RUnlock()

	keyValues, ok := i.settings[name]
	if !ok {
		return section{}
	}

	return buildSection(keyValues)
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
	settingsBag, err := i.loadAndMergeSettings()
	if err != nil {
		return err
	}

	var hasBeenUpdated bool
	i.RLock()
	if !reflect.DeepEqual(i.settings, settingsBag) {
		hasBeenUpdated = true
	}
	i.RUnlock()

	if !hasBeenUpdated {
		return nil
	}

	i.Lock()
	i.settings = settingsBag
	i.Unlock()

	err = i.reloadServices()
	if err != nil {
		return err
	}

	return nil
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

func (i *Implementation) reloadServices() error {
	for _, descriptor := range registry.GetServices() {
		sc, ok := descriptor.Instance.(registry.CanBeReloaded)
		if !ok {
			continue
		}

		logger.Info("Reloading service", "service", descriptor.Name)
		err := sc.Reload()
		if err != nil {
			return err
		}
	}
	return nil
}
