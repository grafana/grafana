package sql

import (
	"context"
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

var _ authzlib.AccessClient = &authzClient{}

type resourceGroup map[string]map[string]interface{}
type authzClient struct {
	client                  authz.Client
	supportedGroupResources resourceGroup
}

// Check implements authz.AccessClient.
func (c authzClient) Check(ctx context.Context, id claims.AuthInfo, req authzlib.CheckRequest) (authzlib.CheckResponse, error) {
	if !c.EnforeRBAC(req.Group, req.Resource) {
		return authzlib.CheckResponse{Allowed: true}, nil
	}
	return c.client.Check(ctx, id, req)
}

// Compile implements authz.AccessClient.
func (c authzClient) Compile(ctx context.Context, id claims.AuthInfo, req authzlib.ListRequest) (authzlib.ItemChecker, error) {
	return func(namespace string, name, folder string) bool {
		// TODO: Implement For now we perform the check for each item.
		if !c.EnforeRBAC(req.Group, req.Resource) {
			return true
		}
		r, err := c.client.Check(ctx, id, authzlib.CheckRequest{
			Verb:      "get",
			Group:     req.Group,
			Resource:  req.Resource,
			Namespace: namespace,
			Name:      name,
			Folder:    folder,
		})
		if err != nil {
			return false
		}
		return r.Allowed
	}, nil
}

func (c authzClient) EnforeRBAC(group, resource string) bool {
	if _, ok := c.supportedGroupResources[group]; ok {
		if _, ok := c.supportedGroupResources[group][resource]; ok {
			return true
		}
	}
	return false
}

// Creates a new ResourceServer
func NewResourceServer(ctx context.Context, db infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg prometheus.Registerer, ac authz.Client) (resource.ResourceServer, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg: reg,
	}
	if ac != nil {
		opts.AccessClient = authzClient{
			client: ac,
			supportedGroupResources: resourceGroup{
				"dashboard.grafana.app": map[string]interface{}{
					"dashboards": nil,
				},
				"folder.grafana.app": map[string]interface{}{
					"folders": nil,
				},
			},
		}
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
