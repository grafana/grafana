package search

import (
	"bytes"
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const DASHBOARD_SCHEMA_VERSION = "schema_version"
const DASHBOARD_LINK_COUNT = "link_count"
const DASHBOARD_PANEL_TYPES = "panel_types"
const DASHBOARD_DS_TYPES = "ds_types"
const DASHBOARD_TRANSFORMATIONS = "transformation"

// Added in enterprise
const DASHBOARD_VIEWS_LAST_1_DAYS = "views_last_1_days"
const DASHBOARD_VIEWS_LAST_7_DAYS = "views_last_7_days"
const DASHBOARD_VIEWS_LAST_30_DAYS = "views_last_30_days"
const DASHBOARD_VIEWS_TOTAL = "views_total"
const DASHBOARD_VIEWS_TODAY = "views_today"
const DASHBOARD_QUERIES_LAST_1_DAYS = "queries_last_1_days"
const DASHBOARD_QUERIES_LAST_7_DAYS = "queries_last_7_days"
const DASHBOARD_QUERIES_LAST_30_DAYS = "queries_last_30_days"
const DASHBOARD_QUERIES_TOTAL = "queries_total"
const DASHBOARD_QUERIES_TODAY = "queries_today"
const DASHBOARD_ERRORS_LAST_1_DAYS = "errors_last_1_days"
const DASHBOARD_ERRORS_LAST_7_DAYS = "errors_last_7_days"
const DASHBOARD_ERRORS_LAST_30_DAYS = "errors_last_30_days"
const DASHBOARD_ERRORS_TOTAL = "errors_total"
const DASHBOARD_ERRORS_TODAY = "errors_today"

func DashboardBuilder(namespaced resource.NamespacedDocumentSupplier) (resource.DocumentBuilderInfo, error) {
	fields, err := resource.NewSearchableDocumentFields([]*resource.ResourceTableColumnDefinition{
		{
			Name:        DASHBOARD_SCHEMA_VERSION,
			Type:        resource.ResourceTableColumnDefinition_INT32,
			Description: "Numeric version saying when the schema was saved",
			Properties: &resource.ResourceTableColumnDefinition_Properties{
				NotNull: true,
			},
		},
		{
			Name:        DASHBOARD_LINK_COUNT,
			Type:        resource.ResourceTableColumnDefinition_INT32,
			Description: "How many links appear on the page",
		},
		{
			Name:        DASHBOARD_PANEL_TYPES,
			Type:        resource.ResourceTableColumnDefinition_STRING,
			IsArray:     true,
			Description: "How many links appear on the page",
			Properties: &resource.ResourceTableColumnDefinition_Properties{
				Filterable: true,
			},
		},
	})
	if namespaced == nil {
		// Use a
		namespaced = func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
			return &DashboardDocumentBuilder{
				Namespace:        namespace,
				Blob:             blob,
				Stats:            map[string]map[string]int64{},
				DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{
					// empty values (does not resolve anything)
				}),
			}, nil
		}
	}
	return resource.DocumentBuilderInfo{
		GroupResource: schema.GroupResource{
			Group:    "dashboards.grafana.app",
			Resource: "dashboards",
		},
		Fields:     fields,
		Namespaced: namespaced,
	}, err
}

type DashboardDocumentBuilder struct {
	// Scoped to a single tenant
	Namespace string

	// Cached stats for this namespace
	// TODO, load this from apiserver request
	Stats map[string]map[string]int64

	// data source lookup
	DatasourceLookup dashboard.DatasourceLookup

	// For large dashboards we will need to load them from blob store
	Blob resource.BlobSupport
}

var _ resource.DocumentBuilder = &DashboardDocumentBuilder{}

func (s *DashboardDocumentBuilder) BuildDocument(ctx context.Context, key *resource.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	if s.Namespace != "" && s.Namespace != key.Namespace {
		return nil, fmt.Errorf("invalid namespace")
	}

	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
	}

	blob := obj.GetBlob()
	if blob != nil {
		rsp, err := s.Blob.GetResourceBlob(ctx, key, blob, true)
		if err != nil {
			return nil, err
		}
		if rsp.Error != nil {
			return nil, fmt.Errorf("error reading blob: %+v", rsp.Error)
		}
		value = rsp.Value
	}

	summary, err := dashboard.ReadDashboard(bytes.NewReader(value), s.DatasourceLookup)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj)
	doc.Title = summary.Title
	doc.Description = summary.Description
	doc.Tags = summary.Tags

	panelTypes := []string{}
	transformations := []string{}
	dsTypes := []string{}

	for _, p := range summary.Panels {
		if p.Type != "" {
			panelTypes = append(panelTypes, p.Type)
		}
		if len(p.Transformer) > 0 {
			transformations = append(transformations, p.Transformer...)
		}
		if p.LibraryPanel != "" {
			doc.References = append(doc.References, resource.ResourceReference{
				Group:    "dashboards.grafana.app",
				Kind:     "LibraryPanel",
				Name:     p.LibraryPanel,
				Relation: "depends-on",
			})
		}
	}

	for _, ds := range summary.Datasource {
		dsTypes = append(dsTypes, ds.Type)
		doc.References = append(doc.References, resource.ResourceReference{
			Group:    ds.Type,
			Kind:     "DataSource",
			Name:     ds.UID,
			Relation: "depends-on",
		})
	}

	doc.Fields = map[string]any{
		DASHBOARD_SCHEMA_VERSION:  summary.SchemaVersion,
		DASHBOARD_LINK_COUNT:      summary.LinkCount,
		DASHBOARD_PANEL_TYPES:     panelTypes,
		DASHBOARD_DS_TYPES:        dsTypes,
		DASHBOARD_TRANSFORMATIONS: transformations,
	}

	// Add the stats fields
	stats, ok := s.Stats[key.Name] // summary.UID
	if ok {
		for k, v := range stats {
			doc.Fields[k] = v
		}
	}

	return doc, nil
}
