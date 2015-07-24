// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"testing"
)

func TestSignificantTermsAggregation(t *testing.T) {
	agg := NewSignificantTermsAggregation().Field("crime_type")
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"significant_terms":{"field":"crime_type"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}

func TestSignificantTermsAggregationSubAggregation(t *testing.T) {
	crimeTypesAgg := NewSignificantTermsAggregation().Field("crime_type")
	agg := NewTermsAggregation().Field("force")
	agg = agg.SubAggregation("significantCrimeTypes", crimeTypesAgg)
	data, err := json.Marshal(agg.Source())
	if err != nil {
		t.Fatalf("marshaling to JSON failed: %v", err)
	}
	got := string(data)
	expected := `{"aggregations":{"significantCrimeTypes":{"significant_terms":{"field":"crime_type"}}},"terms":{"field":"force"}}`
	if got != expected {
		t.Errorf("expected\n%s\n,got:\n%s", expected, got)
	}
}
