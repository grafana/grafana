package object

import (
	"context"
	"fmt"
	"time"
)

// NOTE this is just a temporary registry/list so we can use constants
// TODO replace with codegen from kind schema system

const StandardKindDashboard = "dashboard"
const StandardKindFolder = "folder"
const StandardKindPanel = "panel"         // types: heatmap, timeseries, table, ...
const StandardKindDataSource = "ds"       // types: influx, prometheus, test, ...
const StandardKindTransform = "transform" // types: joinByField, pivot, organizeFields, ...

// This is a stub -- it will soon lookup in a registry of known "kinds"
// Each kind will be able to define:
//  1. sanitize/normalize function  (ie get safe bytes)
//  2. SummaryProvier
func GetSafeSaveObject(ctx context.Context, r *WriteObjectRequest) (*ObjectSummary, []byte, error) {
	var builder ObjectSummaryBuilder
	switch r.Kind {
	// Avoid circular dependency
	// case StandardKindDashboard:
	// 	builder = sobj.NewDashboardSummaryBuilder(dummyDSLookup)
	default:
		builder = dummySummaryBuilder
	}

	return builder(ctx, r.UID, r.Kind, r.Body)
}

// This is just a fake builder for now
var dummySummaryBuilder = func(ctx context.Context, uid string, kind string, body []byte) (*ObjectSummary, []byte, error) {
	summary := &ObjectSummary{
		Name:        fmt.Sprintf("hello: %s", kind),
		Description: fmt.Sprintf("Wrote at %s", time.Now().Local().String()),
		Labels: map[string]string{
			"hello": "world",
			"tag1":  "",
			"tag2":  "",
		},
		Fields: map[string]interface{}{
			"field1": "a string",
			"field2": 1.224,
			"field4": true,
		},
		Error:  nil, // ignore for now
		Nested: nil, // ignore for now
		References: []*ExternalReference{
			{
				Kind: "ds",
				Type: "influx",
				UID:  "xyz",
			},
			{
				Kind: "panel",
				Type: "heatmap",
			},
			{
				Kind: "panel",
				Type: "timeseries",
			},
		},
	}

	if summary.UID != "" && uid != summary.UID {
		return summary, nil, fmt.Errorf("internal UID mismatch")
	}
	if summary.Kind != "" && kind != summary.Kind {
		return summary, nil, fmt.Errorf("internal Kind mismatch")
	}

	return summary, body, nil
}
