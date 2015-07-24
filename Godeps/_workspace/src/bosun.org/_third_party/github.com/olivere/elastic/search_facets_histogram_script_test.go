// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestHistogramScriptFacetWithKeyScripts(t *testing.T) {
	f := NewHistogramScriptFacet().
		KeyScript("doc['date'].date.minuteOfHour").
		ValueScript("doc['num1'].value")
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"histogram":{"key_script":"doc['date'].date.minuteOfHour","value_script":"doc['num1'].value"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHistogramScriptFacetWithParams(t *testing.T) {
	f := NewHistogramScriptFacet().
		KeyScript("doc['date'].date.minuteOfHour * factor1").
		ValueScript("doc['num1'].value * factor2").
		Param("factor1", 2).
		Param("factor2", 3)
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"histogram":{"key_script":"doc['date'].date.minuteOfHour * factor1","params":{"factor1":2,"factor2":3},"value_script":"doc['num1'].value * factor2"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestHistogramScriptFacetWithGlobals(t *testing.T) {
	f := NewHistogramScriptFacet().
		KeyScript("doc['date'].date.minuteOfHour").
		ValueScript("doc['num1'].value").
		Global(true).
		FacetFilter(NewTermFilter("user", "kimchy"))
	data, err := json.Marshal(f.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"facet_filter":{"term":{"user":"kimchy"}},"global":true,"histogram":{"key_script":"doc['date'].date.minuteOfHour","value_script":"doc['num1'].value"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
