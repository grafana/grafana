// Package translations embeds and serves backend-owned translation files.
//
// Each locale ships as {locale}/grafana-advisor.json — a flat map of i18n key →
// translated string. This mirrors the layout the rest of grafana/grafana uses
// for Crowdin-managed translations (public/locales/{locale}/grafana.json,
// packages/grafana-sql/src/locales/{locale}/grafana-sql.json, etc.).
//
// The frontend fetches these via the GET /translations?lang={locale} custom
// route and merges them into the @grafana/i18n namespace for the advisor plugin.
package translations

import (
	"embed"
	"encoding/json"
	"fmt"
	"regexp"
	"sync"
)

// fileName is the per-locale JSON file. Kept in sync with crowdin.yml's
// "source" / "translation" entries for this package.
const fileName = "grafana-advisor.json"

//go:embed */grafana-advisor.json
var fs embed.FS

// localePattern matches BCP 47 language tags we accept (e.g. "en-US", "zh-Hans", "pt").
// This is defense-in-depth — embed.FS itself confines reads to embedded files —
// but a strict validator gives clearer errors and prevents oddball inputs from
// reaching the filesystem call at all.
var localePattern = regexp.MustCompile(`^[a-z]{2,3}(-[A-Za-z]{2,8})?$`)

// IsValidLocale reports whether s looks like a BCP 47 language tag we serve.
func IsValidLocale(s string) bool {
	return localePattern.MatchString(s)
}

// Get returns the translation map for the given locale.
// Returns an empty map (and no error) if no translation file exists for that locale —
// the frontend's t(key, fallback) handles the missing-key case.
func Get(locale string) (map[string]string, error) {
	if !IsValidLocale(locale) {
		return map[string]string{}, fmt.Errorf("invalid locale: %q", locale)
	}
	data, err := fs.ReadFile(locale + "/" + fileName)
	if err != nil {
		// File doesn't exist for this locale — frontend falls back to English defaults.
		return map[string]string{}, nil
	}
	var result map[string]string
	if err := json.Unmarshal(data, &result); err != nil {
		return map[string]string{}, fmt.Errorf("parse translations for %s: %w", locale, err)
	}
	return result, nil
}

// enUS holds the parsed en-US source file. Checks code reads its user-facing
// strings from here (via EN and the helpers below) so the Go code and the
// translation source can't drift apart: adding or changing a string happens
// in en-US/grafana-advisor.json, and Crowdin picks it up from there.
var enUS = sync.OnceValue(func() map[string]string {
	m, err := Get("en-US")
	if err != nil || len(m) == 0 {
		// The en-US file is embedded at compile time; this only trips if it is
		// malformed, which embed_test.go and parity_test.go catch in CI.
		panic(fmt.Sprintf("advisor translations: cannot load embedded en-US source: %v", err))
	}
	return m
})

// EN returns the en-US source string for key. If the key is missing from
// en-US/grafana-advisor.json it returns the key itself, so the gap is visible
// in the UI and caught by parity_test.go.
func EN(key string) string {
	if s, ok := enUS()[key]; ok {
		return s
	}
	return key
}

// The helpers below build keys with the same conventions the frontend uses to
// look up translations from IDs present in the API response (see parity_test.go).

// CheckName returns the en-US display name for a check type, e.g. "data source".
func CheckName(checkTypeID string) string {
	return EN("advisor." + checkTypeID + ".name")
}

// StepTitle returns the en-US title for a check step.
func StepTitle(checkTypeID, stepID string) string {
	return EN("advisor." + checkTypeID + "." + stepID + ".title")
}

// StepDescription returns the en-US description for a check step.
func StepDescription(checkTypeID, stepID string) string {
	return EN("advisor." + checkTypeID + "." + stepID + ".description")
}

// StepResolution returns the en-US resolution for a check step.
func StepResolution(checkTypeID, stepID string) string {
	return EN("advisor." + checkTypeID + "." + stepID + ".resolution")
}

// LinkMessage returns the en-US label for a failure-link button, e.g.
// LinkMessage("fix-me") == "Fix me".
func LinkMessage(slug string) string {
	return EN("advisor.link." + slug)
}
