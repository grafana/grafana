package object

import (
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
const StandardKindQuery = "query"

// This is a stub -- it will soon lookup in a registry of known "kinds"
// Each kind will be able to define:
//  1. sanitize/normalize function  (ie get safe bytes)
//  2. SummaryProvier
func GetSafeSaveObject(r *WriteObjectRequest) (*ObjectSummary, []byte, error) {
	summary := &ObjectSummary{
		Name:        fmt.Sprintf("hello: %s", r.Kind),
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

	if summary.UID != "" && r.UID != summary.UID {
		return nil, nil, fmt.Errorf("internal UID mismatch")
	}
	if summary.Kind != "" && r.Kind != summary.Kind {
		return nil, nil, fmt.Errorf("internal Kind mismatch")
	}

	return summary, r.Body, nil
}
