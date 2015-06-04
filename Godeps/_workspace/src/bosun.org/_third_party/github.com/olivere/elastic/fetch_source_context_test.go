// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestFetchSourceContextNoFetchSource(t *testing.T) {
	builder := NewFetchSourceContext(false)
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `false`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFetchSourceContextNoFetchSourceIgnoreIncludesAndExcludes(t *testing.T) {
	builder := NewFetchSourceContext(false).Include("a", "b").Exclude("c")
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `false`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFetchSourceContextFetchSource(t *testing.T) {
	builder := NewFetchSourceContext(true)
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"excludes":[],"includes":[]}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFetchSourceContextFetchSourceWithIncludesAndExcludes(t *testing.T) {
	builder := NewFetchSourceContext(true).Include("a", "b").Exclude("c")
	data, err := json.Marshal(builder.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"excludes":["c"],"includes":["a","b"]}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFetchSourceContextQueryDefaults(t *testing.T) {
	builder := NewFetchSourceContext(true)
	values := builder.Query()
	got := values.Encode()
	expected := ""
	if got != expected {
		t.Errorf("expected %q; got: %q", expected, got)
	}
}

func TestFetchSourceContextQueryNoFetchSource(t *testing.T) {
	builder := NewFetchSourceContext(false)
	values := builder.Query()
	got := values.Encode()
	expected := "_source=false"
	if got != expected {
		t.Errorf("expected %q; got: %q", expected, got)
	}
}

func TestFetchSourceContextQueryFetchSourceWithIncludesAndExcludes(t *testing.T) {
	builder := NewFetchSourceContext(true).Include("a", "b").Exclude("c")
	values := builder.Query()
	got := values.Encode()
	expected := "_source_exclude=c&_source_include=a%2Cb"
	if got != expected {
		t.Errorf("expected %q; got: %q", expected, got)
	}
}
