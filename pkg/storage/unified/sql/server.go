package sql

import (
	"context"
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a new ResourceServer
func NewResourceServer(ctx context.Context, db infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg prometheus.Registerer) (resource.ResourceServer, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg: reg,
	}

	// Support local file blob
	if strings.HasPrefix(opts.Blob.URL, "./data/") {
		dir := strings.Replace(opts.Blob.URL, "./data", cfg.DataPath, 1)
		err := os.MkdirAll(dir, 0700)
		if err != nil {
			return nil, err
		}
		opts.Blob.URL = "file:///" + dir
	}

	eDB, err := dbimpl.ProvideResourceDB(db, cfg, tracer)
	if err != nil {
		return nil, err
	}
	store, err := NewBackend(BackendOptions{DBProvider: eDB, Tracer: tracer})
	if err != nil {
		return nil, err
	}
	opts.Backend = store
	opts.Diagnostics = store
	opts.Lifecycle = store

	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) {
		opts.Index = resource.NewResourceIndexServer(cfg, tracer)
	}

	rs, err := resource.NewResourceServer(opts)
	if err != nil {
		return nil, err
	}

	// Initialize the indexer if one is configured
	if opts.Index != nil {
		// TODO: Create a proper identity for the indexer
		orgId := int64(1)
		ctx = identity.WithRequester(ctx, &identity.StaticRequester{
			Type:           claims.TypeServiceAccount, // system:apiserver
			UserID:         1,
			OrgID:          int64(1),
			Name:           "admin",
			Login:          "admin",
			OrgRole:        identity.RoleAdmin,
			IsGrafanaAdmin: true,
			Permissions: map[int64]map[string][]string{
				orgId: {
					"*": {"*"}, // all resources, all scopes
				},
			},
		})
		_, err = rs.(resource.ResourceIndexer).Index(ctx)
		if err != nil {
			return nil, err
		}
	}

	return rs, nil
}
