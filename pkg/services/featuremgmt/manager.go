package featuremgmt

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

var (
	_ FeatureToggles = (*FeatureManager)(nil)
)

// FeatureManager provides a management interface for feature toggles. Changes
// to feature toggles are propagated to registered OpenFeature provider(s).
//
// Currently the FeatureManager also implements the FeatureToggles interface,
// allowing clients to evaluate feature toggles from it. However in general,
// clients should use an OpenFeature Client directly.
type FeatureManager struct {
	Settings setting.FeatureMgmtSettings

	log log.Logger

	ofClient openfeature.IClient
	prov     FeatureProvider
}

// newFeatureManager creates a new FeatureManager with the given settings and
// static provider. The provider must already be configured as the default Provider.
func newFeatureManager(settings setting.FeatureMgmtSettings, log log.Logger, prov FeatureProvider, client openfeature.IClient) *FeatureManager {
	return &FeatureManager{
		Settings: settings,
		log:      log,
		ofClient: client,
		prov:     prov,
	}
}

// IsEnabled checks if a feature is enabled
// Deprecated: Use an OpenFeature client directly instead
func (fm *FeatureManager) IsEnabled(ctx context.Context, flag string) bool {
	boolDetails, err := fm.ofClient.BooleanValueDetails(ctx, flag, false, openfeature.EvaluationContext{})
	if err != nil {
		fm.log.Error("failed to evaluate feature flag", "flag", flag, "error", err, "reason", string(boolDetails.Reason))
		return false
	}

	return boolDetails.Value
}

// IsEnabledGlobally checks if a feature is for all tenants
// Deprecated: Use an OpenFeature client directly instead
func (fm *FeatureManager) IsEnabledGlobally(flag string) bool {
	// for now this is the same as IsEnabled with no context
	return fm.IsEnabled(context.Background(), flag)
}

// GetEnabled returns a map containing only the features that are enabled
func (fm *FeatureManager) GetEnabled(ctx context.Context) map[string]bool {
	return fm.prov.GetEnabled(ctx)
}

// GetFlags returns all flag definitions
func (fm *FeatureManager) GetFlags() []FeatureFlag {
	return fm.prov.GetFlags()
}

// isFeatureEditingAllowed checks if the backend is properly configured to allow feature toggle changes from the UI
func (fm *FeatureManager) IsFeatureEditingAllowed() bool {
	return fm.Settings.AllowEditing && fm.Settings.UpdateWebhook != ""
}

// indicate if a change has been made (not that accurate, but better than nothing)
func (fm *FeatureManager) IsRestartRequired() bool {
	return fm.prov.IsRestartRequired()
}

// Flags that can be edited
func (fm *FeatureManager) IsEditableFromAdminPage(key string) bool {
	// TODO: move this down to the provider
	flag := fm.prov.GetFlag(key)
	if flag == nil ||
		!fm.IsFeatureEditingAllowed() ||
		!flag.AllowSelfServe ||
		flag.Name == FlagFeatureToggleAdminPage {
		return false
	}
	return flag.Stage == FeatureStageGeneralAvailability ||
		flag.Stage == FeatureStagePublicPreview ||
		flag.Stage == FeatureStageDeprecated
}

// Flags that should not be shown in the UI (regardless of their state)
func (fm *FeatureManager) IsHiddenFromAdminPage(key string, lenient bool) bool {
	// TODO: move this down to the provider
	_, hide := fm.Settings.HiddenToggles[key]
	flag := fm.prov.GetFlag(key)
	if flag == nil || flag.HideFromAdminPage || hide {
		return true // unknown flag (should we show it as a warning!)
	}

	// Explicitly hidden from configs
	_, found := fm.Settings.HiddenToggles[key]
	if found {
		return true
	}
	if lenient {
		return false
	}

	return flag.Stage == FeatureStageUnknown ||
		flag.Stage == FeatureStageExperimental ||
		flag.Stage == FeatureStagePrivatePreview
}

// Get the flags that were explicitly set on startup
func (fm *FeatureManager) GetStartupFlags() map[string]bool {
	return fm.prov.GetStartupFlags()
}

// Perhaps expose the flag warnings
func (fm *FeatureManager) GetWarning() map[string]string {
	return fm.prov.GetWarnings()
}

func (fm *FeatureManager) SetRestartRequired() {
	fm.prov.SetRestartRequired()
}

// ############# Test Functions #############

func WithFeatures(spec ...any) FeatureToggles {
	return WithManager(spec...)
}

// WithFeatures is used to define feature toggles for testing.
// The arguments are a list of strings that are optionally followed by a boolean value for example:
// WithFeatures([]any{"my_feature", "other_feature"}) or WithFeatures([]any{"my_feature", true})
func WithManager(spec ...any) *FeatureManager {
	count := len(spec)
	flags := make([]*FeatureFlag, 0, count)
	disabled := []string{}

	for idx := 0; idx < count; {
		key := fmt.Sprintf("%v", spec[idx])
		flags = append(flags, &FeatureFlag{Name: key})

		idx++

		// if the next item is a boolean...
		if idx < count && reflect.TypeOf(spec[idx]).Kind() == reflect.Bool {
			// if it's false, it gets explicitly disabled
			if !spec[idx].(bool) {
				disabled = append(disabled, key)
			}

			idx++
		}
	}

	return WithFeatureManager(setting.FeatureMgmtSettings{}, flags, disabled...)
}

// WithFeatureManager is used to define feature toggle manager for testing.
// It should be used when your test feature toggles require metadata beyond `Name` and `Enabled`.
// You should provide a feature toggle Name at a minimum.
func WithFeatureManager(cfg setting.FeatureMgmtSettings, flags []*FeatureFlag, disabled ...string) *FeatureManager {
	dis := make(map[string]bool)
	for _, v := range disabled {
		dis[v] = true
	}

	prov := newProvider(false, log.New("featuremgmt"))

	for _, f := range flags {
		if f.Name == "" {
			continue
		}
		prov.flags[f.Name] = f
		prov.startup[f.Name] = !dis[f.Name]
		if !dis[f.Name] {
			// only set enabled if it's not disabled
			prov.enabled[f.Name] = true
		}
	}

	client := &testClient{provider: prov}

	return newFeatureManager(cfg, nil, prov, client)
}
