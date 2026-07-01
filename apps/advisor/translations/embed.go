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
