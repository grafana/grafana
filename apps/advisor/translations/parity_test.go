package translations

import (
	"sort"
	"testing"
)

// This file enforces parity between i18n keys the frontend will look up and
// the entries in en-US.json. The keys are constructed by the frontend at
// runtime from IDs already present in the API response:
//
//   advisor.{checkTypeID}.name                                     — check type display name annotation
//   advisor.{checkTypeID}.{stepID}.{title,description,resolution}  — per-step step fields
//   advisor.link.{slug}                                            — failure-link button label
//
// The backend does NOT ship these keys on the wire; they're implied by the
// naming convention. The checks code itself reads its user-facing strings from
// en-US.json through EN() and the helpers in embed.go, so en-US.json is the
// single source of truth: a key missing there surfaces as the raw key in the
// UI. When you add a new check type, step, or failure-link message, you must:
//
//   1. Wire it in apps/advisor/pkg/app/checks/... (pointing at the new key)
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

// linkSlugs is the set of static failure-link button labels (slugified) that
// steps produce via inline advisor.CheckErrorLink{...} literals. The frontend
// derives the key as advisor.link.{slug} from the English link.message.
var linkSlugs = []string{
	"avoid-default-value",
	"change-provisioning-file",
	"check-the-documentation",
	"configure-provider",
	"delete-data-source",
	"fix-me",
	"install-amazon-managed-service-for-prometheus",
	"install-azure-monitor-managed-service-for-prometheus",
	"upgrade",
	"view-azure-auth-docs",
	"view-plugin",
	"view-sigv4-docs",
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
	for _, slug := range linkSlugs {
		keys = append(keys, "advisor.link."+slug)
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
