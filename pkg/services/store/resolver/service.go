package resolver

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

const (
	WarningNotImplemented           = "not implemented"
	WarningDatasourcePluginNotFound = "datasource plugin not found"
	WarningTypeNotSpecified         = "type not specified"
	WarningPluginNotFound           = "plugin not found"
)

// for testing
var getNow = func() time.Time { return time.Now() }

type ResolutionInfo struct {
	OK        bool      `json:"ok"`
	Key       string    `json:"key,omitempty"`  // GRN? UID?
	Warning   string    `json:"kind,omitempty"` // old syntax?  (name>uid) references a renamed object?
	Timestamp time.Time `json:"timestamp,omitempty"`
}

type EntityReferenceResolver interface {
	Resolve(ctx context.Context, ref *entity.EntityExternalReference) (ResolutionInfo, error)
}

func ProvideEntityReferenceResolver(ds datasources.DataSourceService, pluginStore plugins.Store) EntityReferenceResolver {
	return &standardReferenceResolver{
		pluginStore: pluginStore,
		ds: dsCache{
			ds:          ds,
			pluginStore: pluginStore,
		},
	}
}

type standardReferenceResolver struct {
	pluginStore plugins.Store
	ds          dsCache
}

func (r *standardReferenceResolver) Resolve(ctx context.Context, ref *entity.EntityExternalReference) (ResolutionInfo, error) {
	if ref == nil {
		return ResolutionInfo{OK: false, Timestamp: getNow()}, fmt.Errorf("ref is nil")
	}

	switch ref.Family {
	case entity.StandardKindDataSource:
		return r.resolveDatasource(ctx, ref)

	case entity.ExternalEntityReferencePlugin:
		return r.resolvePlugin(ctx, ref)

		// case entity.ExternalEntityReferenceRuntime:
		// 	return ResolutionInfo{
		// 		OK:        false,
		// 		Timestamp: getNow(),
		// 		Warning:   WarningNotImplemented,
		// 	}, nil
	}

	return ResolutionInfo{
		OK:        false,
		Timestamp: getNow(),
		Warning:   WarningNotImplemented,
	}, nil
}

func (r *standardReferenceResolver) resolveDatasource(ctx context.Context, ref *entity.EntityExternalReference) (ResolutionInfo, error) {
	ds, err := r.ds.getDS(ctx, ref.Identifier)
	if err != nil || ds == nil || ds.UID == "" {
		return ResolutionInfo{
			OK:        false,
			Timestamp: r.ds.timestamp,
		}, err
	}

	res := ResolutionInfo{
		OK:        true,
		Timestamp: r.ds.timestamp,
		Key:       ds.UID, // TODO!
	}
	if !ds.PluginExists {
		res.OK = false
		res.Warning = WarningDatasourcePluginNotFound
	} else if ref.Type == "" {
		ref.Type = ds.Type // awkward! but makes the reporting accurate for dashboards before schemaVersion 36
		res.Warning = WarningTypeNotSpecified
	} else if ref.Type != ds.Type {
		res.Warning = fmt.Sprintf("type mismatch (expect:%s, found:%s)", ref.Type, ds.Type)
	}
	return res, nil
}

func (r *standardReferenceResolver) resolvePlugin(ctx context.Context, ref *entity.EntityExternalReference) (ResolutionInfo, error) {
	p, ok := r.pluginStore.Plugin(ctx, ref.Identifier)
	if !ok {
		return ResolutionInfo{
			OK:        false,
			Timestamp: getNow(),
			Warning:   WarningPluginNotFound,
		}, nil
	}

	if p.Type != plugins.Type(ref.Type) {
		return ResolutionInfo{
			OK:        false,
			Timestamp: getNow(),
			Warning:   fmt.Sprintf("expected type: %s, found%s", ref.Type, p.Type),
		}, nil
	}

	return ResolutionInfo{
		OK:        true,
		Timestamp: getNow(),
	}, nil
}
