package object

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// NOTE this is just a temporary registry/list so we can use constants
// TODO replace with codegen from kind schema system

// This is a stub -- it will soon lookup in a registry of known "kinds"
// Each kind will be able to define:
//  1. sanitize/normalize function  (ie get safe bytes)
//  2. SummaryProvier
func GetSafeSaveObject(ctx context.Context, r *WriteObjectRequest) (*models.ObjectSummary, []byte, error) {
	// var builder kind.ObjectSummaryBuilder
	// switch r.Kind {
	// case kind.StandardKindPlaylist:
	// 	builder = playlist.GetSummaryBuilder()
	// case kind.StandardKindDashboard:
	// 	// TODO: use real datasource lookup
	// 	builder = schemaless.NewDashboardSummaryBuilder(kind.dummyDSLookup())
	// default:
	// 	builder = getDummySummary(r.Kind)
	// }

	// return builder(ctx, r.UID, r.Body)
	return nil, nil, nil
}
