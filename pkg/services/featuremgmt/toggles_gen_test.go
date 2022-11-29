package featuremgmt

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt/strcase"
)

func TestFeatureToggleFiles(t *testing.T) {
	legacyNames := map[string]bool{
		"httpclientprovider_azure_auth": true,
		"service-accounts":              true,
		"database_metrics":              true,
		"live-config":                   true,
		"live-pipeline":                 true,
		"live-service-web-worker":       true,
	}

	t.Run("verify files", func(t *testing.T) {
		// Typescript files
		verifyAndGenerateFile(t,
			"../../../packages/grafana-data/src/types/featureToggles.gen.ts",
			generateTypeScript(),
		)

		// Golang files
		verifyAndGenerateFile(t,
			"toggles_gen.go",
			generateRegistry(t),
		)

		// Docs files
		verifyAndGenerateFile(t,
			"../../../docs/sources/setup-grafana/configure-grafana/feature-toggles/index.md",
			generateDocsMD(),
		)
	})

	t.Run("check feature naming convention", func(t *testing.T) {
		invalidNames := make([]string, 0)
		for _, f := range standardFeatureFlags {
			if legacyNames[f.Name] {
				continue
			}

			if f.Name != strcase.ToLowerCamel(f.Name) {
				invalidNames = append(invalidNames, f.Name)
			}
		}

		require.Empty(t, invalidNames, "%s feature names should be camel cased", invalidNames)
		// acronyms can be configured as needed via `ConfigureAcronym` function from `./strcase/camel.go`
	})
}

func verifyAndGenerateFile(t *testing.T, fpath string, gen string) {
	// nolint:gosec
	// We can ignore the gosec G304 warning since this is a test and the function is only called explicitly above
	body, err := os.ReadFile(fpath)
	if err == nil {
		if diff := cmp.Diff(gen, string(body)); diff != "" {
			str := fmt.Sprintf("body mismatch (-want +got):\n%s\n", diff)
			err = fmt.Errorf(str)
		}
	}

	if err != nil {
		e2 := os.WriteFile(fpath, []byte(gen), 0644)
		if e2 != nil {
			t.Errorf("error writing file: %s", e2.Error())
		}
		abs, _ := filepath.Abs(fpath)
		t.Errorf("feature toggle do not match: %s (%s)", err.Error(), abs)
		t.Fail()
	}
}

func generateTypeScript() string {
	buf := `// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

/**
 * Describes available feature toggles in Grafana. These can be configured via
 * conf/custom.ini to enable features under development or not yet available in
 * stable version.
 *
 * Only enabled values will be returned in this interface
 *
 * @public
 */
export interface FeatureToggles {
  [name: string]: boolean | undefined; // support any string value

`
	for _, flag := range standardFeatureFlags {
		buf += "  " + getTypeScriptKey(flag.Name) + "?: boolean;\n"
	}

	buf += "}\n"
	return buf
}

func getTypeScriptKey(key string) string {
	if strings.Contains(key, "-") || strings.Contains(key, ".") {
		return "['" + key + "']"
	}
	return key
}

func isLetterOrNumber(c rune) bool {
	return !unicode.IsLetter(c) && !unicode.IsNumber(c)
}

func asCamelCase(key string) string {
	parts := strings.FieldsFunc(key, isLetterOrNumber)
	for idx, part := range parts {
		parts[idx] = strings.Title(part)
	}
	return strings.Join(parts, "")
}

func generateRegistry(t *testing.T) string {
	tmpl, err := template.New("fn").Parse(`
{{"\t"}}// Flag{{.CamelCase}}{{.Ext}}
{{"\t"}}Flag{{.CamelCase}} = "{{.Flag.Name}}"
`)
	if err != nil {
		t.Fatal("error reading template", "error", err.Error())
		return ""
	}

	data := struct {
		CamelCase string
		Flag      FeatureFlag
		Ext       string
	}{
		CamelCase: "?",
	}

	var buff bytes.Buffer

	buff.WriteString(`// NOTE: This file was auto generated.  DO NOT EDIT DIRECTLY!
// To change feature flags, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go

package featuremgmt

const (`)

	for _, flag := range standardFeatureFlags {
		data.CamelCase = asCamelCase(flag.Name)
		data.Flag = flag
		data.Ext = ""

		if flag.Description != "" {
			data.Ext += "\n\t// " + flag.Description
		}

		_ = tmpl.Execute(&buff, data)
	}
	buff.WriteString(")\n")

	return buff.String()
}

func generateDocsMD() string {
	buf := `---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/
description: Learn about toggles for experimental and beta features, which you can enable or disable.
title: Configure feature toggles
weight: 150
---

# Configure feature toggles

Feature toggles, also known as feature flags, are used for experimental or beta features in Grafana. Although we do not recommend that you use these features in production, you can turn on feature toggles to try out new functionality in development or test environments.

This page contains a list of available feature toggles. To learn how to turn on feature toggles, refer to our [Configure Grafana documentation]({{< relref "../_index.md/#feature_toggles" >}}). Feature toogles are also available to Grafana Cloud Advanced customers - if you use Grafana Cloud Advanced, you can open a support ticket specifying the feature toggles and stack you would like them enabled 

## Available feature toggles
| Feature toggle name | Description                                           | Release stage | Enabled by default |
|---------------------|-------------------------------------------------------|---------------|--------------------|
`
	for _, flag := range standardFeatureFlags {
		if !flag.RequiresDevMode {
			on := ""
			if flag.Expression == "true" {
				on = "Yes"
			}
			buf += "| " + flag.Name + " | " + flag.Description + " | " + flag.State.String() + " | " + on + "  | \n"
		}
	}

	buf += `
## Development feature toggles

The following toggles require explicitly setting Grafana's [app mode]({{< relref "../_index.md/#app_mode" >}}) to 'development' before you can enable this feature toggle. These features tend to be especially experimental.


| Feature toggle name | Description                                           | 
|---------------------|-------------------------------------------------------|
`
	for _, flag := range standardFeatureFlags {
		if flag.RequiresDevMode {
			buf += "| " + flag.Name + " | " + flag.Description + " | \n"
		}
	}

	return buf
}
