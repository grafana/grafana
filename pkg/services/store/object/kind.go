package object

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/coremodel/dashboard/schemaless"
	"github.com/grafana/grafana/pkg/coremodel/playlist"
	"github.com/grafana/grafana/pkg/models"
)

// NOTE this is just a temporary registry/list so we can use constants
// TODO replace with codegen from kind schema system

const StandardKindDashboard = "dashboard"
const StandardKindFolder = "folder"
const StandardKindPanel = "panel"         // types: heatmap, timeseries, table, ...
const StandardKindDataSource = "ds"       // types: influx, prometheus, test, ...
const StandardKindTransform = "transform" // types: joinByField, pivot, organizeFields, ...
const StandardKindPlaylist = "playlist"

// This is a stub -- it will soon lookup in a registry of known "kinds"
// Each kind will be able to define:
//  1. sanitize/normalize function  (ie get safe bytes)
//  2. SummaryProvier
func GetSafeSaveObject(ctx context.Context, r *WriteObjectRequest) (*models.ObjectSummary, []byte, error) {
	var builder models.ObjectSummaryBuilder
	switch r.Kind {
	case StandardKindPlaylist:
		builder = playlist.GetSummaryBuilder()
	case StandardKindDashboard:
		// TODO: use real datasource lookup
		builder = schemaless.NewDashboardSummaryBuilder(dummyDSLookup())
	default:
		builder = getDummySummary(r.Kind)
	}

	return builder(ctx, r.UID, r.Body)
}

// This is just a fake builder for now
func getDummySummary(kind string) models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		summary := &models.ObjectSummary{
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
			References: []*models.ObjectExternalReference{
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
}

func dummyDSLookup() schemaless.DatasourceLookup {
	return schemaless.CreateDatasourceLookup([]*schemaless.DatasourceQueryResult{
		{
			UID:       "sqlite-2",
			Type:      "sqlite-datasource",
			Name:      "SQLite Grafana2",
			IsDefault: false,
		},
		{
			UID:       "default.uid",
			Type:      "default.type",
			Name:      "default.name",
			IsDefault: true,
		},
	})
}
