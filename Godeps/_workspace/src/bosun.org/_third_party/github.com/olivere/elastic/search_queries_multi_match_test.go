// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestMultiMatchQuery(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMultiMatchQueryBestFields(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message").Type("best_fields")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test","tie_breaker":0,"type":"best_fields"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMultiMatchQueryMostFields(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message").Type("most_fields")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test","tie_breaker":1,"type":"most_fields"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMultiMatchQueryCrossFields(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message").Type("cross_fields")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test","tie_breaker":0,"type":"cross_fields"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMultiMatchQueryPhrase(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message").Type("phrase")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test","tie_breaker":0,"type":"phrase"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMultiMatchQueryPhrasePrefix(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message").Type("phrase_prefix")
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test","tie_breaker":0,"type":"phrase_prefix"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestMultiMatchQueryBestFieldsWithCustomTieBreaker(t *testing.T) {
	q := NewMultiMatchQuery("this is a test", "subject", "message").
		Type("best_fields").
		TieBreaker(0.3)
	data, err := json.Marshal(q.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"multi_match":{"fields":["subject","message"],"query":"this is a test","tie_breaker":0.3,"type":"best_fields"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
