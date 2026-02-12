package builders

import (
	"bytes"
	"context"
	"encoding/json"

	claims "github.com/grafana/authlib/types"
	sdkResource "github.com/grafana/grafana-app-sdk/resource"

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

	doc := resource.NewIndexableDocument(key, rv, obj)
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
