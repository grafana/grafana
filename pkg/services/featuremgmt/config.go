package featuremgmt

// func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
// 	// Read and populate feature toggles list
// 	toggles, err := loadFeatureTogglesFromConfiguration(featureFlagOptions{
// 		cfgSection:   iniFile.Section("feature_toggles"),
// 		isDev:        cfg.Env == Dev,
// 		isEnterprise: cfg.IsEnterprise,
// 		flags:        featureToggleRegistry, // hardcoded in sibling file
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	cfg.Features = *toggles

// 	return nil
// }

// type featureFlagOptions struct {
// 	cfgSection   *ini.Section
// 	isDev        bool
// 	isEnterprise bool
// 	flags        []FeatureToggleInfo
// }

// func loadFeatureTogglesFromConfiguration(opts featureFlagOptions) (*FeatureToggles, error) {
// 	registry := initFeatureToggleRegistry(opts.flags)
// 	ff := &FeatureToggles{
// 		enabled: make(map[string]bool, len(registry)),
// 		info:    opts.flags,
// 	}

// 	// parse the comma separated list in `enable`.
// 	featuresTogglesStr := valueAsString(opts.cfgSection, "enable", "")
// 	for _, feature := range util.SplitString(featuresTogglesStr) {
// 		setToggle(registry, feature, true, ff)
// 	}

// 	// read all other settings under [feature_toggles]. If a toggle is
// 	// present in both the value in `enable` is overridden.
// 	for _, v := range opts.cfgSection.Keys() {
// 		if v.Name() == "enable" {
// 			continue
// 		}

// 		b, err := strconv.ParseBool(v.Value())
// 		if err != nil {
// 			return ff, err
// 		}

// 		setToggle(registry, v.Name(), b, ff)
// 	}

// 	// Validate flags based on runtime state
// 	for _, info := range registry {
// 		if info.Enabled {
// 			if info.RequiresDevMode && !opts.isDev {
// 				info.Enabled = false
// 				ff.notice = append(ff.notice, "(%s) can only run in development mode", info.Id)
// 			}

// 			if info.RequiresEnterprise && !opts.isEnterprise {
// 				info.Enabled = false
// 				ff.notice = append(ff.notice, "(%s) requires an enterprise license", info.Id)
// 			}
// 		}

// 		val := 0.0
// 		if info.Enabled {
// 			val = 1.0
// 			ff.enabled[info.Id] = true
// 		}
// 		// track if feature toggles are enabled or not using an info metric
// 		featureToggleInfo.WithLabelValues(info.Id).Set(val)
// 	}

// 	return ff, nil
// }

// func initFeatureToggleRegistry(opts []FeatureToggleInfo) map[string]*FeatureToggleInfo {
// 	featureToggles := make(map[string]*FeatureToggleInfo, len(opts)+5)
// 	for idx, info := range opts {
// 		featureToggles[info.Id] = &opts[idx]
// 		if info.AliasIds != nil {
// 			for _, alias := range info.AliasIds {
// 				featureToggles[alias] = featureToggles[info.Id]
// 			}
// 		}
// 	}
// 	return featureToggles
// }

// func setToggle(registry map[string]*FeatureToggleInfo, key string, val bool, ff *FeatureToggles) {
// 	info, ok := registry[key]
// 	if ok {
// 		info.Enabled = val
// 	} else {
// 		ff.enabled[key] = val // register it even when unknown
// 		ff.notice = append(ff.notice, fmt.Sprintf("Unknown feature toggle: %s", key))
// 	}
// }
