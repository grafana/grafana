package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

var _ simple.KindMutator = NewMutator(&Config{})

type Mutator struct {
	config *Config
}

// NewMutator creates a new mutator for StaleDashboardTracker
func NewMutator(config *Config) *Mutator {
	return &Mutator{config: config}
}

// Mutate mutates a StaleDashboardTracker object
func (m *Mutator) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	// TODO: Add mutation logic
	// - Set default values if not provided
	// - Initialize status fields

	return &app.MutatingResponse{
		UpdatedObject: req.Object,
	}, nil
}
