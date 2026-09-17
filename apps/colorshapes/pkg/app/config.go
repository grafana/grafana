package app

import (
	"context"
	"time"
)

// Hit is one row of the colorshapes app's own table (not a k8s kind/unified storage
// resource — see apps/colorshapes/plan.md for why).
type Hit struct {
	CreatedAt int64
	SourceIP  string
	Color     string
	Shape     string
	CreatedBy string
}

// Store is implemented in the main grafana module (pkg/storage/colorshapes), which has
// access to the shared db.DB service. This app's own go.mod stays free of that
// dependency, matching how other apps/* modules are kept lightweight.
type Store interface {
	Insert(ctx context.Context, createdBy, sourceIP, color, shape string) error
	List(ctx context.Context, from, to time.Time) ([]Hit, error)
}

// Config is the colorshapes app-specific config, injected via app.Config.SpecificConfig
// by pkg/registry/apps/colorshapes/register.go.
type Config struct {
	Store Store
}
