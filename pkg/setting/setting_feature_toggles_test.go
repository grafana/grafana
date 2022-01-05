package setting

import (
	"fmt"
	"io/ioutil"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestFeatureToggles(t *testing.T) {
	testCases := []struct {
		name            string
		conf            map[string]string
		err             error
		expectedToggles map[string]bool
		opts            *featureFlagOptions
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]bool{
				"feature1": true,
				"feature2": true,
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]bool{
				"feature1": true,
				"feature2": true,
				"feature3": true,
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]bool{
				"feature1": true,
				"feature2": false,
			},
		},
		{
			name: "invalid boolean value should return syntax error",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "invalid",
			},
			expectedToggles: map[string]bool{},
			err:             strconv.ErrSyntax,
		},
		{
			name: "should override default feature toggles",
			opts: &featureFlagOptions{
				flags: []FeatureToggleInfo{
					{
						Id:      "feature1",
						Enabled: true,
					},
				}},
			conf: map[string]string{
				"feature1": "false",
			},
			expectedToggles: map[string]bool{
				"feature1": false,
			},
		},
	}

	for _, tc := range testCases {
		f := ini.Empty()

		toggles, _ := f.NewSection("feature_toggles")
		for k, v := range tc.conf {
			_, err := toggles.NewKey(k, v)
			require.ErrorIs(t, err, nil)
		}

		opts := &featureFlagOptions{}

		if tc.opts != nil {
			opts = tc.opts
		}

		if len(opts.flags) < 1 {
			opts.flags = []FeatureToggleInfo{
				{
					Id: featureToggle_dashboardPreviews,
				},
				{
					Id: featureToggle_newNavigation,
				},
			}
		}

		opts.cfgSection = toggles
		featureToggles, err := loadFeatureTogglesFromConfiguration(*opts)
		require.ErrorIs(t, err, tc.err)

		if err == nil {
			for k, v := range tc.expectedToggles {
				require.Equal(t, featureToggles.IsEnabled(k), v, tc.name)
			}
		}
	}
}

func TestFeatureToggleRegistry(t *testing.T) {
	tsgen := generateTypeScript()

	fpath := "../../packages/grafana-data/src/types/featureToggles.gen.ts"
	body, err := ioutil.ReadFile(fpath)
	if err == nil && tsgen != string(body) {
		err = fmt.Errorf("feature toggle typescript does not match")
	}

	if err != nil {
		_ = os.WriteFile(fpath, []byte(tsgen), 0644)
		t.Errorf("Feature toggle typescript does not match: %s", err.Error())
		t.Fail()
	}
}

func generateTypeScript() string {
	buf := `// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/setting/setting_feature_toggles_registry.go

/**
 * Describes available feature toggles in Grafana. These can be configured via
 * conf/custom.ini to enable features under development or not yet available in
 * stable version.
 *
 * @public
 */
export interface FeatureToggles {
	[name: string]: boolean;

`
	for _, flag := range featureToggleRegistry {
		buf += "  " + getTypeScriptKey(flag.Id) + ": boolean;\n"
	}

	buf += `
}

/**
 * @public
 */
export const defalutFeatureToggles: FeatureToggles = {
`
	for _, flag := range featureToggleRegistry {
		buf += "  " + getTypeScriptKey(flag.Id) + ": " + strconv.FormatBool(flag.Enabled) + ",\n"
	}

	buf += "}\n\n"

	return buf
}

func getTypeScriptKey(key string) string {
	if strings.Contains(key, "-") {
		return "['" + key + "']"
	}
	return key
}
