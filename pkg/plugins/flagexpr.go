package plugins

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"text/template"
)

// FlagExpr is the plugin.json "available" value: a static boolean or an
// OpenFeature expression evaluated when building the nav tree.
//
// JSON shapes:
//
//	true / false                                       -> Static
//	"some.flag.key"                                     -> sugar for "{{ flag `some.flag.key` false }}"
//	"{{ flag `some.flag.key` false }}"                   -> Template, explicit fallback
//	"{{ or (flag `a` false) (flag `b` true) }}"           -> Template, compound
//
// A nil *FlagExpr (omitted field) means "always available"; callers handle it.
type FlagExpr struct {
	// Static holds a literal JSON boolean.
	Static *bool
	// raw preserves the expanded template source for JSON round-trips.
	raw string
	// Template is parsed from a JSON string. Callers must clone it and bind
	// "flag" to a request-scoped implementation before execution.
	Template *template.Template
}

// placeholderFlagFuncs allows validation before a request-scoped flag function exists.
var placeholderFlagFuncs = template.FuncMap{
	"flag": func(string, bool) bool { return false },
}

func (f *FlagExpr) UnmarshalJSON(data []byte) error {
	var b bool
	if err := json.Unmarshal(data, &b); err == nil {
		f.Static = &b
		return nil
	}

	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	if !strings.Contains(s, "{{") {
		// Bare keys default to false if the flag can't be resolved.
		s = "{{ flag `" + s + "` false }}"
	}

	tmpl, err := template.New("available").Funcs(placeholderFlagFuncs).Parse(s)
	if err != nil {
		return err
	}
	// Execute to validate function arguments and ensure the result is a boolean;
	// parsing alone doesn't catch either error.
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, nil); err != nil {
		return fmt.Errorf("invalid \"available\" expression %q: %w", s, err)
	}
	if _, err := strconv.ParseBool(buf.String()); err != nil {
		return fmt.Errorf("invalid \"available\" expression %q: does not evaluate to a boolean (got %q)", s, buf.String())
	}
	f.raw = s
	f.Template = tmpl
	return nil
}

func (f *FlagExpr) MarshalJSON() ([]byte, error) {
	if f.Static != nil {
		return json.Marshal(*f.Static)
	}
	if f.Template != nil {
		return json.Marshal(f.raw)
	}
	return []byte("null"), nil
}
