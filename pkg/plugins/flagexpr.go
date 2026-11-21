package plugins

import (
	"encoding/json"
	"fmt"
)

// FlagExpr is the plugin.json "available" value: a static boolean, a bare
// flag key (implicitly fails closed if the flag can't be resolved), or an
// explicit {flag, fallback} object when the author wants a different
// fallback.
//
// JSON shapes:
//
//	true / false                                -> Static
//	"some.flag.key"                              -> Flag, Fallback: false
//	{"flag": "some.flag.key", "fallback": true}  -> Flag, Fallback: true
//
// A nil *FlagExpr (omitted field) means "always available"; callers handle it.
type FlagExpr struct {
	// Static holds a literal JSON boolean.
	Static *bool
	// Flag is the feature flag key, set when the JSON value was a string or
	// a {flag, fallback} object.
	Flag *string
	// Fallback is used when Flag can't be resolved (unknown key, provider
	// unreachable). Only meaningful when Flag is set.
	Fallback bool
}

type flagExprObject struct {
	Flag     string `json:"flag"`
	Fallback bool   `json:"fallback"`
}

func (f *FlagExpr) UnmarshalJSON(data []byte) error {
	// Reset in case this instance is being reused for a second decode.
	f.Static = nil
	f.Flag = nil
	f.Fallback = false

	var b bool
	if err := json.Unmarshal(data, &b); err == nil {
		f.Static = &b
		return nil
	}

	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		f.Flag = &s
		f.Fallback = false
		return nil
	}

	var obj flagExprObject
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}
	if obj.Flag == "" {
		return fmt.Errorf(`invalid "available" value: object form requires a non-empty "flag"`)
	}
	f.Flag = &obj.Flag
	f.Fallback = obj.Fallback
	return nil
}

func (f *FlagExpr) MarshalJSON() ([]byte, error) {
	if f.Static != nil {
		return json.Marshal(*f.Static)
	}
	if f.Flag != nil {
		return json.Marshal(flagExprObject{Flag: *f.Flag, Fallback: f.Fallback})
	}
	return []byte("null"), nil
}
