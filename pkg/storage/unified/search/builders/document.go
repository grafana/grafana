package builders

import (
	"bytes"
	"context"
	"encoding/json"

	claims "github.com/grafana/authlib/types"
	sdkResource "github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// All returns all document builders from this package.
// These builders have dependencies on Grafana apps (dashboard and user).
func All(sql db.DB, sprinkles DashboardStats) ([]resource.DocumentBuilderInfo, error) {
	dashboards, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		logger := log.New("dashboard_builder", "namespace", namespace)
		dsinfo := []*dashboard.DatasourceQueryResult{{}}
		ns, err := claims.ParseNamespace(namespace)
		if err != nil && sql != nil {
			rows, err := sql.GetSqlxSession().Query(ctx, "SELECT uid,type,name,is_default FROM data_source WHERE org_id=?", ns.OrgID)
			if err != nil {
				return nil, err
			}

			defer func() {
				_ = rows.Close()
			}()

			for rows.Next() {
				info := &dashboard.DatasourceQueryResult{}
				err = rows.Scan(&info.UID, &info.Type, &info.Name, &info.IsDefault)
				if err != nil {
					return nil, err
				}
				dsinfo = append(dsinfo, info)
			}
		}

		var stats map[string]map[string]int64
		if sprinkles != nil {
			stats, err = sprinkles.GetStats(ctx, namespace)
			if err != nil {
				logger.Warn("Failed to get sprinkles", "error", err)
			}
		}

		return &DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            stats,
			DatasourceLookup: dashboard.CreateDatasourceLookup(dsinfo),
		}, nil
	})

	if err != nil {
		return nil, err
	}

	users, err := GetUserBuilder()
	if err != nil {
		return nil, err
	}

	extGroupMappings, err := GetExternalGroupMappingBuilder()
	if err != nil {
		return nil, err
	}

	teams, err := GetTeamSearchBuilder()
	if err != nil {
		return nil, err
	}

	teamBindings, err := GetTeamBindingBuilder()
	if err != nil {
		return nil, err
	}

	return []resource.DocumentBuilderInfo{dashboards, users, extGroupMappings, teams, teamBindings}, nil
}

// tableColumnsByName builds a map[fieldName]*ResourceTableColumnDefinition
// from the given SearchFieldDefinitions. Used by IAM builders that expose
// the historical XxxTableColumnDefinitions shape for wire-API consumers
// (legacy SQL search backends) that look fields up by name.
func tableColumnsByName(sfds []resource.SearchFieldDefinition) map[string]*resourcepb.ResourceTableColumnDefinition {
	cols := resource.SearchFieldDefinitionsToTableColumns(sfds)
	out := make(map[string]*resourcepb.ResourceTableColumnDefinition, len(cols))
	for _, c := range cols {
		out[c.Name] = c
	}
	return out
}

// iamBuilder assembles the DocumentBuilderInfo for an IAM kind. Every IAM kind
// is wired the same way: its search fields come from the generated IAM manifest
// and its documents are extracted by the standard builder, so only the resource
// and its field set differ per kind.
func iamBuilder(ri utils.ResourceInfo, searchFields []resource.SearchFieldDefinition) (resource.DocumentBuilderInfo, error) {
	gvr := ri.GroupVersionResource()
	gr := ri.GroupResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{gvr: searchFields},
		// The preferred version for this resource. Documents stored with an
		// apiVersion the server does not recognise fall back to it when their
		// fields are extracted. IAM kinds serve a single version, so that is the
		// value here.
		map[schema.GroupResource]string{gr: gvr.Version},
	)

	return resource.DocumentBuilderInfo{
		GroupResource:        gr,
		Builder:              resource.StandardDocumentBuilderWithFields(iamManifests, provider),
		SearchFieldsHash:     provider.IndexAffectingHash(gr.Group, gr.Resource),
		SearchFieldsProvider: provider,
	}, nil
}

// NewIndexableDocumentFromValue parses provided bytes value into object, and initializes IndexableDocument from it.
func NewIndexableDocumentFromValue(key *resourcepb.ResourceKey, rv int64, value []byte, resObj sdkResource.Object, kind sdkResource.Kind) (*resource.IndexableDocument, error) {
	err := json.NewDecoder(bytes.NewReader(value)).Decode(resObj)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(resObj)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj, "")
	doc.Fields = make(map[string]any)
	doc.SelectableFields, err = BuildSelectableFields(resObj, kind)
	return doc, err
}

// BuildSelectableFields returns a map of non-empty selectable fields and their values based on selectable fields defined for the kind.
func BuildSelectableFields(obj sdkResource.Object, kind sdkResource.Kind) (map[string]string, error) {
	if len(kind.SelectableFields()) == 0 {
		return nil, nil
	}

	result := make(map[string]string, len(kind.SelectableFields()))
	for _, sf := range kind.SelectableFields() {
		val, err := sf.FieldValueFunc(obj)
		if err != nil {
			return nil, err
		}
		if val != "" {
			result[sf.FieldSelector] = val
		}
	}
	return result, nil
}
