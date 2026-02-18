package dashboard

import (
	"context"
	"encoding/json"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

type datasourceIndexProvider struct {
	datasourceService datasources.DataSourceService
}

// Index builds a datasource index directly from the datasource service query.
// This is more efficient than GetDataSourceInfo + NewDatasourceIndex as it avoids
// creating an intermediate slice and iterates over the datasources only once.
func (d *datasourceIndexProvider) Index(ctx context.Context) *schemaversion.DatasourceIndex {
	ctx, span := tracing.Start(ctx, "dashboard.datasource_index.build")
	defer span.End()

	// Extract namespace info from context to get OrgID
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		span.SetAttributes(attribute.String("error", "namespace_info_not_available"))
		// If namespace info is not available, return empty index
		return &schemaversion.DatasourceIndex{
			ByName: make(map[string]*schemaversion.DataSourceInfo),
			ByUID:  make(map[string]*schemaversion.DataSourceInfo),
		}
	}

	span.SetAttributes(attribute.Int64("org_id", nsInfo.OrgID))

	// Use GetDataSources with OrgID query
	query := datasources.GetDataSourcesQuery{
		OrgID: nsInfo.OrgID,
	}
	dataSources, err := d.datasourceService.GetDataSources(ctx, &query)

	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		span.RecordError(err)
		return &schemaversion.DatasourceIndex{
			ByName: make(map[string]*schemaversion.DataSourceInfo),
			ByUID:  make(map[string]*schemaversion.DataSourceInfo),
		}
	}

	span.SetAttributes(attribute.Int("datasources.count", len(dataSources)))

	// Build index directly without intermediate slice allocation
	// Single iteration over datasources populates all maps
	index := &schemaversion.DatasourceIndex{
		ByName: make(map[string]*schemaversion.DataSourceInfo, len(dataSources)),
		ByUID:  make(map[string]*schemaversion.DataSourceInfo, len(dataSources)),
	}

	for _, ds := range dataSources {
		dsInfo := &schemaversion.DataSourceInfo{
			Name:       ds.Name,
			UID:        ds.UID,
			ID:         ds.ID,
			Type:       ds.Type,
			Default:    ds.IsDefault,
			APIVersion: ds.APIVersion,
		}

		// Index by name if present
		if ds.Name != "" {
			index.ByName[ds.Name] = dsInfo
		}

		// Index by UID if present
		if ds.UID != "" {
			index.ByUID[ds.UID] = dsInfo
		}

		// Track default datasource
		if ds.IsDefault {
			index.DefaultDS = dsInfo
		}
	}

	return index
}

type libraryElementIndexProvider struct {
	libraryElementService libraryelements.Service
}

func (l *libraryElementIndexProvider) GetLibraryElementInfo(ctx context.Context) []schemaversion.LibraryElementInfo {
	ctx, span := tracing.Start(ctx, "dashboard.library_element_index.build")
	defer span.End()

	if l.libraryElementService == nil {
		span.SetAttributes(attribute.String("error", "service_nil"))
		return []schemaversion.LibraryElementInfo{}
	}

	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		span.SetAttributes(attribute.String("error", "namespace_info_not_available"))
		span.RecordError(err)
		return []schemaversion.LibraryElementInfo{}
	}

	span.SetAttributes(attribute.Int64("org_id", nsInfo.OrgID))

	user := &identity.StaticRequester{
		OrgID:   nsInfo.OrgID,
		OrgRole: identity.RoleAdmin,
	}

	const perPage = 1_000
	info := make([]schemaversion.LibraryElementInfo, 0)
	// For some reason the index starts at page 1 here:
	// https://github.com/grafana/grafana/blob/main/pkg/services/libraryelements/database.go#L418
	page := 1
	for {
		result, err := l.libraryElementService.GetAllElements(ctx, user, model.SearchLibraryElementsQuery{
			PerPage: perPage,
			Page:    page,
		})
		if err != nil {
			span.SetAttributes(attribute.String("error", err.Error()))
			span.RecordError(err)
			return []schemaversion.LibraryElementInfo{}
		}

		for _, elem := range result.Elements {
			var modelUnstructured v0alpha1.Unstructured
			if len(elem.Model) > 0 {
				var modelObj map[string]any
				if err := json.Unmarshal(elem.Model, &modelObj); err == nil {
					modelUnstructured.Object = modelObj
				}
			}
			info = append(info, schemaversion.LibraryElementInfo{
				UID:         elem.UID,
				Name:        elem.Name,
				Kind:        elem.Kind,
				Type:        elem.Type,
				Description: elem.Description,
				FolderUID:   elem.FolderUID,
				Model:       modelUnstructured,
			})
		}

		if len(result.Elements) < perPage {
			break
		}
		page++

		// Bound pages to avoid inf loops
		if page > 100 {
			break
		}
	}

	span.SetAttributes(
		attribute.Int("library_elements.count", len(info)),
		attribute.Int("library_elements.pages_fetched", page),
	)

	return info
}
