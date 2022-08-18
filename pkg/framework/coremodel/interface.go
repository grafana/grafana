package coremodel

// Generates all code derived from coremodel Thema lineages that's used directly
// by both the frontend and backend.
//go:generate go run gen.go

import (
	"github.com/grafana/thema"
)

// Interface is the primary coremodel interface that must be implemented by all
// Grafana coremodels.  A coremodel is the foundational, canonical schema for
// some known-at-compile-time Grafana object.
//
// Currently, all Coremodels are expressed as Thema lineages.
type Interface interface {
	// Lineage should return the canonical Thema lineage for the coremodel.
	Lineage() thema.Lineage

	// CurrentSchema should return the schema of the version that the Grafana backend
	// is currently written against. (While Grafana can accept data from all
	// older versions of the Thema schema, backend Go code is written against a
	// single version for simplicity)
	CurrentSchema() thema.Schema

	// GoType should return a pointer to the Go struct type that corresponds to
	// the Current() schema.
	GoType() interface{}
}
