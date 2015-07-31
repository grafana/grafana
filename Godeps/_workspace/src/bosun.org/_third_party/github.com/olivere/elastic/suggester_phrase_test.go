// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestPhraseSuggesterSource(t *testing.T) {
	s := NewPhraseSuggester("name").
		Text("Xor the Got-Jewel").
		Analyzer("body").
		Field("bigram").
		Size(1).
		RealWordErrorLikelihood(0.95).
		MaxErrors(0.5).
		GramSize(2).
		Highlight("<em>", "</em>")
	data, err := json.Marshal(s.Source(true))
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"name":{"text":"Xor the Got-Jewel","phrase":{"analyzer":"body","field":"bigram","gram_size":2,"highlight":{"post_tag":"\u003c/em\u003e","pre_tag":"\u003cem\u003e"},"max_errors":0.5,"real_word_error_likelihood":0.95,"size":1}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestPhraseSuggesterSourceWithContextQuery(t *testing.T) {
	geomapQ := NewSuggesterGeoMapping("location").
		Precision("1km", "5m").
		Neighbors(true).
		FieldName("pin").
		DefaultLocations(GeoPointFromLatLon(0.0, 0.0))

	s := NewPhraseSuggester("name").
		Text("Xor the Got-Jewel").
		Analyzer("body").
		Field("bigram").
		Size(1).
		RealWordErrorLikelihood(0.95).
		MaxErrors(0.5).
		GramSize(2).
		Highlight("<em>", "</em>").
		ContextQuery(geomapQ)
	data, err := json.Marshal(s.Source(true))
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"name":{"text":"Xor the Got-Jewel","phrase":{"analyzer":"body","context":{"location":{"default":{"lat":0,"lon":0},"neighbors":true,"path":"pin","precision":["1km","5m"],"type":"geo"}},"field":"bigram","gram_size":2,"highlight":{"post_tag":"\u003c/em\u003e","pre_tag":"\u003cem\u003e"},"max_errors":0.5,"real_word_error_likelihood":0.95,"size":1}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestPhraseSuggesterComplexSource(t *testing.T) {
	g1 := NewDirectCandidateGenerator("body").
		SuggestMode("always").
		MinWordLength(1)

	g2 := NewDirectCandidateGenerator("reverse").
		SuggestMode("always").
		MinWordLength(1).
		PreFilter("reverse").
		PostFilter("reverse")

	s := NewPhraseSuggester("simple_phrase").
		Text("Xor the Got-Jewel").
		Analyzer("body").
		Field("bigram").
		Size(4).
		RealWordErrorLikelihood(0.95).
		Confidence(2.0).
		GramSize(2).
		CandidateGenerators(g1, g2).
		CollateQuery(`"match":{"{{field_name}}" : "{{suggestion}}"}`).
		CollateParams(map[string]interface{}{"field_name": "title"}).
		CollatePreference("_primary").
		CollatePrune(true)
	data, err := json.Marshal(s.Source(true))
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"simple_phrase":{"text":"Xor the Got-Jewel","phrase":{"analyzer":"body","collate":{"params":{"field_name":"title"},"preference":"_primary","prune":true,"query":"\"match\":{\"{{field_name}}\" : \"{{suggestion}}\"}"},"confidence":2,"direct_generator":[{"field":"body","min_word_length":1,"suggest_mode":"always"},{"field":"reverse","min_word_length":1,"post_filter":"reverse","pre_filter":"reverse","suggest_mode":"always"}],"field":"bigram","gram_size":2,"real_word_error_likelihood":0.95,"size":4}}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestPhraseStupidBackoffSmoothingModel(t *testing.T) {
	s := NewStupidBackoffSmoothingModel(0.42)
	data, err := json.Marshal(s.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	// The source does NOT include the smoothing model type!
	expected := `{"discount":0.42}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
	if s.Type() != "stupid_backoff" {
		t.Errorf("expected %q, got: %q", "stupid_backoff", s.Type())
	}
}

func TestPhraseLaplaceSmoothingModel(t *testing.T) {
	s := NewLaplaceSmoothingModel(0.63)
	data, err := json.Marshal(s.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	// The source does NOT include the smoothing model type!
	expected := `{"alpha":0.63}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
	if s.Type() != "laplace" {
		t.Errorf("expected %q, got: %q", "laplace", s.Type())
	}
}

func TestLinearInterpolationSmoothingModel(t *testing.T) {
	s := NewLinearInterpolationSmoothingModel(0.3, 0.2, 0.05)
	data, err := json.Marshal(s.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	// The source does NOT include the smoothing model type!
	expected := `{"bigram_lambda":0.2,"trigram_lambda":0.3,"unigram_lambda":0.05}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
	if s.Type() != "linear_interpolation" {
		t.Errorf("expected %q, got: %q", "linear_interpolation", s.Type())
	}
}
