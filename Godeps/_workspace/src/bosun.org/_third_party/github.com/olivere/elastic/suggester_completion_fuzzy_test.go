// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestFuzzyCompletionSuggesterSource(t *testing.T) {
	s := NewFuzzyCompletionSuggester("song-suggest").
		Text("n").
		Field("suggest").
		Fuzziness(2)
	data, err := json.Marshal(s.Source(true))
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"song-suggest":{"text":"n","completion":{"field":"suggest","fuzziness":2}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestFuzzyCompletionSuggesterWithStringFuzzinessSource(t *testing.T) {
	s := NewFuzzyCompletionSuggester("song-suggest").
		Text("n").
		Field("suggest").
		Fuzziness("1..4")
	data, err := json.Marshal(s.Source(true))
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"song-suggest":{"text":"n","completion":{"field":"suggest","fuzziness":"1..4"}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
