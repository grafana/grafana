package featuremgmt

import (
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"testing"
)

func TestFeatureToggleTypeScript(t *testing.T) {
	tsgen := generateTypeScript()

	fpath := "../../../packages/grafana-data/src/types/featureToggles.gen.ts"
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

import { RegistryItem } from '../utils/Registry';

/**
 * Describes available feature toggles in Grafana. These can be configured via
 * conf/custom.ini to enable features under development or not yet available in
 * stable version.
 *
 * @public
 */
export interface FeatureToggles {
  // [name: string]?: boolean; // support any string value

`
	for _, flag := range standardFeatureFlags {
		buf += "  " + getTypeScriptKey(flag.Name) + "?: boolean;\n"
	}

	buf += `}

/**
 * Metadata about each feature flag
 *
 * @internal
 */
export interface FeatureFlagInfo extends RegistryItem {
  docsURL?: string;
  enabled?: boolean;
  requiresDevMode?: boolean;
  requiresEnterprise?: boolean;
  modifiesDatabase?: boolean;
  frontend?: boolean;
}
`

	return buf
}

func getTypeScriptKey(key string) string {
	if strings.Contains(key, "-") {
		return "['" + key + "']"
	}
	return key
}
