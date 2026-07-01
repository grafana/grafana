package translations

import (
	"sort"
	"testing"
)

// This file enforces parity between i18n keys emitted by the Go code and the
// entries in en-US.json. When you add a new check type, step, or failure-link
// message, you must:
//
//   1. Wire it in apps/advisor/pkg/app/checks/...
//   2. Add the matching entry to en-US.json
//   3. Update the table below
//
// Missing any of these will fail this test. Crowdin picks up new en-US keys
// automatically; this test prevents the Go side from drifting out of sync.

// checkTypeSteps maps every check type ID to its step IDs. For each entry we
// expect advisor.{type}.name plus advisor.{type}.{step}.{title,description,resolution}.
var checkTypeSteps = map[string][]string{
	"config":     {"security_config"},
	"datasource": {"health-check", "missing-plugin", "prom-dep-auth", "uid-validation"},
	"instance":   {"out_of_support_version", "pinned_version"},
	"plugin":     {"deprecation", "twinmaker_sceneviewer", "unsigned", "update"},
	"ssosetting": {"sso-list-format-validation"},
}

// stepLinks maps "{checkType}.{stepID}" to the link slugs that step emits via
// checks.NewCheckErrorLink. The key in en-US.json is
// advisor.{checkType}.{stepID}.link.{slug}.
var stepLinks = map[string][]string{
	"config.security_config":                {"avoid-default-value"},
	"datasource.health-check":               {"fix-me"},
	"datasource.missing-plugin":             {"delete-data-source", "view-plugin"},
	"datasource.prom-dep-auth":              {"change-provisioning-file", "view-azure-auth-docs", "view-sigv4-docs"},
	"plugin.deprecation":                    {"view-plugin"},
	"plugin.twinmaker_sceneviewer":          {"view-plugin"},
	"plugin.unsigned":                       {"view-plugin"},
	"plugin.update":                         {"upgrade"},
	"ssosetting.sso-list-format-validation": {"check-the-documentation", "configure-provider"},
}

func expectedKeys() []string {
	var keys []string
	for checkType, steps := range checkTypeSteps {
		keys = append(keys, "advisor."+checkType+".name")
		for _, step := range steps {
			keys = append(keys,
				"advisor."+checkType+"."+step+".title",
				"advisor."+checkType+"."+step+".description",
				"advisor."+checkType+"."+step+".resolution",
			)
		}
	}
	for combined, links := range stepLinks {
		for _, link := range links {
			keys = append(keys, "advisor."+combined+".link."+link)
		}
	}
	sort.Strings(keys)
	return keys
}

func TestEnUSContainsAllExpectedKeys(t *testing.T) {
	m, err := Get("en-US")
	if err != nil {
		t.Fatalf("loading en-US: %v", err)
	}
	for _, k := range expectedKeys() {
		v, ok := m[k]
		if !ok {
			t.Errorf("en-US.json is missing key %q — add it to en-US.json", k)
			continue
		}
		if v == "" {
			t.Errorf("en-US.json has empty value for key %q", k)
		}
	}
}

func TestEnUSHasNoOrphanKeys(t *testing.T) {
	m, err := Get("en-US")
	if err != nil {
		t.Fatalf("loading en-US: %v", err)
	}
	expected := make(map[string]struct{}, len(expectedKeys()))
	for _, k := range expectedKeys() {
		expected[k] = struct{}{}
	}
	for k := range m {
		if _, ok := expected[k]; !ok {
			t.Errorf("en-US.json has unexpected key %q — remove it or add the corresponding emission in the Go code and update parity_test.go", k)
		}
	}
}
