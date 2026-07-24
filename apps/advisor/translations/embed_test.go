package translations

import (
	"testing"
)

func TestGet_EnUS(t *testing.T) {
	got, err := Get("en-US")
	if err != nil {
		t.Fatalf("Get(en-US) returned error: %v", err)
	}
	if len(got) == 0 {
		t.Fatalf("Get(en-US) returned empty map; expected backend translation keys")
	}
	// Sanity-check a known key from Phase 4. If this assertion ever fires,
	// the registerer's derived-key convention probably changed and en-US.json
	// is out of sync.
	if v, ok := got["advisor.plugin.deprecation.title"]; !ok || v == "" {
		t.Errorf("expected advisor.plugin.deprecation.title to be present and non-empty, got %q", v)
	}
}

func TestGet_UnknownLocale(t *testing.T) {
	got, err := Get("xx-XX")
	if err != nil {
		t.Fatalf("Get(xx-XX) returned error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("Get(xx-XX) returned %d keys; expected empty map for missing locale", len(got))
	}
}

func TestGet_InvalidLocale(t *testing.T) {
	cases := []string{
		"../etc/passwd",
		"",
		"en_US",   // underscore not allowed
		"english", // too long for primary subtag
		"en-US-extra-extra-extra",
	}
	for _, c := range cases {
		if _, err := Get(c); err == nil {
			t.Errorf("Get(%q) expected error, got nil", c)
		}
	}
}

func TestIsValidLocale(t *testing.T) {
	valid := []string{"en-US", "es-ES", "pt-BR", "zh-Hans", "pt", "fr-FR"}
	for _, v := range valid {
		if !IsValidLocale(v) {
			t.Errorf("IsValidLocale(%q) = false, want true", v)
		}
	}
	invalid := []string{"", "en_US", "../foo", "EN-US", "english"}
	for _, v := range invalid {
		if IsValidLocale(v) {
			t.Errorf("IsValidLocale(%q) = true, want false", v)
		}
	}
}
