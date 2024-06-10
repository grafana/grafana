package featuremgmt

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/olekukonko/tablewriter"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	featuretoggleapi "github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt/strcase"
)

func TestFeatureToggleFiles(t *testing.T) {
	legacyNames := map[string]bool{
		"live-service-web-worker": true,
	}

	t.Run("check registry constraints", func(t *testing.T) {
		invalidNames := make([]string, 0)

		// Check that all flags set in code are valid
		for _, flag := range standardFeatureFlags {
			if flag.Expression == "true" && !(flag.Stage == FeatureStageGeneralAvailability || flag.Stage == FeatureStageDeprecated) {
				t.Errorf("only FeatureStageGeneralAvailability or FeatureStageDeprecated features can be enabled by default.  See: %s", flag.Name)
			}
			if flag.RequiresDevMode && flag.Stage != FeatureStageExperimental {
				t.Errorf("only alpha features can require dev mode.  See: %s", flag.Name)
			}
			if flag.Stage == FeatureStageUnknown {
				t.Errorf("standard toggles should not have an unknown state.  See: %s", flag.Name)
			}
			if flag.Description != strings.TrimSpace(flag.Description) {
				t.Errorf("flag Description should not start/end with spaces.  See: %s", flag.Name)
			}
			if flag.Name != strings.TrimSpace(flag.Name) {
				t.Errorf("flag Name should not start/end with spaces.  See: %s", flag.Name)
			}
			if flag.AllowSelfServe && !(flag.Stage == FeatureStageGeneralAvailability || flag.Stage == FeatureStagePublicPreview || flag.Stage == FeatureStageDeprecated) {
				t.Errorf("only allow self-serving GA, PublicPreview and Deprecated toggles")
			}
			if flag.Owner == "" {
				t.Errorf("feature %s does not have an owner. please fill the FeatureFlag.Owner property", flag.Name)
			}
			// Check camel case names
			if flag.Name != strcase.ToLowerCamel(flag.Name) && !legacyNames[flag.Name] {
				invalidNames = append(invalidNames, flag.Name)
			}
		}

		// Make sure the names are valid
		require.Empty(t, invalidNames, "%s feature names should be camel cased", invalidNames)
		// acronyms can be configured as needed via `ConfigureAcronym` function from `./strcase/camel.go`

		// Now that we know they are valid, update the json database
		t.Run("update k8s resource list", func(t *testing.T) {
			created := v1.NewTime(time.Now().UTC())
			resourceVersion := fmt.Sprintf("%d", created.UnixMilli())

			featuresFile := "toggles_gen.json"
			current := featuretoggleapi.FeatureList{
				TypeMeta: v1.TypeMeta{
					Kind:       "FeatureList",
					APIVersion: featuretoggleapi.APIVERSION,
				},
			}
			existing := featuretoggleapi.FeatureList{}
			body, err := os.ReadFile(featuresFile)
			if err == nil {
				_ = json.Unmarshal(body, &existing)
				current.ListMeta = existing.ListMeta
			}

			lookup := map[string]featuretoggleapi.FeatureSpec{}
			for _, flag := range standardFeatureFlags {
				lookup[flag.Name] = featuretoggleapi.FeatureSpec{
					Description:       flag.Description,
					Stage:             flag.Stage.String(),
					Owner:             string(flag.Owner),
					RequiresDevMode:   flag.RequiresDevMode,
					FrontendOnly:      flag.FrontendOnly,
					RequiresRestart:   flag.RequiresRestart,
					AllowSelfServe:    flag.AllowSelfServe,
					HideFromAdminPage: flag.HideFromAdminPage,
					HideFromDocs:      flag.HideFromDocs,
					// EnabledVersion: ???,
				}

				// Replace them all
				// current.Items = append(current.Items, featuretoggleapi.Feature{
				// 	ObjectMeta: v1.ObjectMeta{
				// 		Name:              flag.Name,
				// 		CreationTimestamp: v1.NewTime(flag.Created),
				// 		ResourceVersion:   fmt.Sprintf("%d", flag.Created.UnixMilli()),
				// 	},
				// 	Spec: lookup[flag.Name],
				// })
				// current.ListMeta.ResourceVersion = resourceVersion
			}

			// Check for changes in any existing values
			for _, item := range existing.Items {
				v, ok := lookup[item.Name]
				if ok {
					delete(lookup, item.Name)
					a, e1 := json.Marshal(v)
					b, e2 := json.Marshal(item.Spec)
					if e1 != nil || e2 != nil || !bytes.Equal(a, b) {
						item.ResourceVersion = resourceVersion
						if item.Annotations == nil {
							item.Annotations = make(map[string]string)
						}
						item.Annotations[utils.AnnoKeyUpdatedTimestamp] = created.String()
						item.Spec = v // the current value
					}
				} else if item.DeletionTimestamp == nil {
					item.DeletionTimestamp = &created
					fmt.Printf("mark feature as deleted")
				}
				current.Items = append(current.Items, item)
			}

			// New flags not in the existing list
			for k, v := range lookup {
				current.Items = append(current.Items, featuretoggleapi.Feature{
					ObjectMeta: v1.ObjectMeta{
						Name:              k,
						CreationTimestamp: created,
						ResourceVersion:   fmt.Sprintf("%d", created.UnixMilli()),
					},
					Spec: v,
				})
			}

			out, err := json.MarshalIndent(current, "", "  ")
			require.NoError(t, err)

			err = os.WriteFile(featuresFile, out, 0644)
			require.NoError(t, err, "error writing file")
		})
	})

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

		// CSV Analytics
		verifyAndGenerateFile(t,
			"toggles_gen.csv",
			generateCSV(),
		)
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
 * Only enabled values will be returned in this interface.
 *
 * NOTE: the possible values may change between versions without notice, although
 * this may cause compilation issues when depending on removed feature keys, the
 * runtime state will continue to work.
 *
 * @public
 */
export interface FeatureToggles {
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
		data.CamelCase = strcase.ToCamel(flag.Name)
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

func generateCSV() string {
	var buf bytes.Buffer

	w := csv.NewWriter(&buf)
	if err := w.Write([]string{
		"Name",
		"Stage",           //flag.Stage.String(),
		"Owner",           //string(flag.Owner),
		"requiresDevMode", //strconv.FormatBool(flag.RequiresDevMode),
		"RequiresRestart", //strconv.FormatBool(flag.RequiresRestart),
		"FrontendOnly",    //strconv.FormatBool(flag.FrontendOnly),
	}); err != nil {
		log.Fatalln("error writing record to csv:", err)
	}

	for _, flag := range standardFeatureFlags {
		if err := w.Write([]string{
			flag.Name,
			flag.Stage.String(),
			string(flag.Owner),
			strconv.FormatBool(flag.RequiresDevMode),
			strconv.FormatBool(flag.RequiresRestart),
			strconv.FormatBool(flag.FrontendOnly),
		}); err != nil {
			log.Fatalln("error writing record to csv:", err)
		}
	}

	w.Flush()
	return buf.String()
}

func generateDocsMD() string {
	hasDeprecatedFlags := false

	buf := `---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/
description: Learn about feature toggles, which you can enable or disable.
title: Configure feature toggles
weight: 150
---

<!-- DO NOT EDIT THIS PAGE, it is machine generated by running the test in -->
<!-- https://github.com/grafana/grafana/blob/main/pkg/services/featuremgmt/toggles_gen_test.go#L19 -->

# Configure feature toggles

You use feature toggles, also known as feature flags, to enable or disable features in Grafana. You can turn on feature toggles to try out new functionality in development or test environments.

This page contains a list of available feature toggles. To learn how to turn on feature toggles, refer to our [Configure Grafana documentation]({{< relref "../_index.md#feature_toggles" >}}). Feature toggles are also available to Grafana Cloud Advanced customers. If you use Grafana Cloud Advanced, you can open a support ticket and specify the feature toggles and stack for which you want them enabled.

## Feature toggles

Some features are enabled by default. You can disable these feature by setting the feature flag to "false" in the configuration.

` + writeToggleDocsTable(func(flag FeatureFlag) bool {
		return flag.Stage == FeatureStageGeneralAvailability
	}, true)

	buf += `
## Preview feature toggles

` + writeToggleDocsTable(func(flag FeatureFlag) bool {
		return flag.Stage == FeatureStagePublicPreview
	}, false)

	if hasDeprecatedFlags {
		buf += `
## Deprecated feature toggles

When features are slated for removal, they will be marked as Deprecated first.

	` + writeToggleDocsTable(func(flag FeatureFlag) bool {
			return flag.Stage == FeatureStageDeprecated
		}, false)
	}

	buf += `
## Experimental feature toggles

These features are early in their development lifecycle and so are not yet supported in Grafana Cloud.
Experimental features might be changed or removed without prior notice.

` + writeToggleDocsTable(func(flag FeatureFlag) bool {
		return flag.Stage == FeatureStageExperimental && !flag.RequiresDevMode
	}, false)

	buf += `
## Development feature toggles

The following toggles require explicitly setting Grafana's [app mode]({{< relref "../_index.md#app_mode" >}}) to 'development' before you can enable this feature toggle. These features tend to be experimental.

` + writeToggleDocsTable(func(flag FeatureFlag) bool {
		return flag.RequiresDevMode
	}, false)
	return buf
}

func writeToggleDocsTable(include func(FeatureFlag) bool, showEnableByDefault bool) string {
	data := [][]string{}

	for _, flag := range standardFeatureFlags {
		if include(flag) && !flag.HideFromDocs {
			row := []string{"`" + flag.Name + "`", flag.Description}
			if showEnableByDefault {
				on := ""
				if flag.Expression == "true" {
					on = "Yes"
				}
				row = append(row, on)
			}
			data = append(data, row)
		}
	}

	header := []string{"Feature toggle name", "Description"}
	if showEnableByDefault {
		header = append(header, "Enabled by default")
	}

	sb := &strings.Builder{}
	table := tablewriter.NewWriter(sb)
	table.SetHeader(header)
	table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
	table.SetCenterSeparator("|")
	table.SetAutoFormatHeaders(false)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAutoWrapText(false)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.AppendBulk(data) // Add Bulk Data
	table.Render()

	// Markdown table formatting (from prittier)
	v := strings.ReplaceAll(sb.String(), "|--", "| -")
	return strings.ReplaceAll(v, "--|", "- |")
}
