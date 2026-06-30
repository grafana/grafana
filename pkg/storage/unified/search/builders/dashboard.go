package builders

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"sort"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const DASHBOARD_SCHEMA_VERSION = "schema_version"
const DASHBOARD_LINK_COUNT = "link_count"
const DASHBOARD_PANEL_TYPES = "panel_types"
const DASHBOARD_PANEL_TITLE = "panel_title"
const DASHBOARD_DS_TYPES = "ds_types"
const DASHBOARD_TRANSFORMATIONS = "transformation"
const DASHBOARD_LIBRARY_PANEL_REFERENCE = "reference.LibraryPanel"

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

// DashboardSearchFields declares the search fields a dashboard document
// emits. Every entry has Path: "" (computed): the dashboard builder
// parses the spec itself, so the standard path-based extractor is not
// used. Non-string fields with [filter, retrieve] fall through to bleve's
// dynamic mapping (numeric, boolean) so range queries and numeric sort
// keep working.
var DashboardSearchFields = []resource.SearchFieldDefinition{
	{Name: DASHBOARD_SCHEMA_VERSION, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Numeric version saying when the schema was saved"},
	{Name: DASHBOARD_LINK_COUNT, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "How many links appear on the page"},
	{Name: DASHBOARD_PANEL_TITLE, Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve}, Description: "The panel title text"},
	{Name: DASHBOARD_PANEL_TYPES, Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "The panel types used in this dashboard"},
	{Name: DASHBOARD_DS_TYPES, Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Data source types referenced by this dashboard's panels"},
	{Name: DASHBOARD_TRANSFORMATIONS, Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Transformation IDs used in this dashboard's panels"},

	// Usage-insights counters, populated externally by DashboardStats.
	// Order matches the historical column-definition list (errors, queries,
	// views) so the wire-API column metadata produced from these SFDs
	// preserves the sequence clients have always seen.
	{Name: DASHBOARD_ERRORS_TODAY, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of errors that occurred today"},
	{Name: DASHBOARD_ERRORS_LAST_1_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of errors that occurred in the last 1 days"},
	{Name: DASHBOARD_ERRORS_LAST_7_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of errors that occurred in the last 7 days"},
	{Name: DASHBOARD_ERRORS_LAST_30_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of errors that occurred in the last 30 days"},
	{Name: DASHBOARD_ERRORS_TOTAL, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Total number of errors"},
	{Name: DASHBOARD_QUERIES_TODAY, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of queries that occurred today"},
	{Name: DASHBOARD_QUERIES_LAST_1_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of queries that occurred in the last 1 days"},
	{Name: DASHBOARD_QUERIES_LAST_7_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of queries that occurred in the last 7 days"},
	{Name: DASHBOARD_QUERIES_LAST_30_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of queries that occurred in the last 30 days"},
	{Name: DASHBOARD_QUERIES_TOTAL, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Total number of queries"},
	{Name: DASHBOARD_VIEWS_TODAY, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of views that occurred today"},
	{Name: DASHBOARD_VIEWS_LAST_1_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of views that occurred in the last 1 days"},
	{Name: DASHBOARD_VIEWS_LAST_7_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of views that occurred in the last 7 days"},
	{Name: DASHBOARD_VIEWS_LAST_30_DAYS, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Number of views that occurred in the last 30 days"},
	{Name: DASHBOARD_VIEWS_TOTAL, Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}, Description: "Total number of views"},
}

func DashboardBuilder(namespaced resource.NamespacedDocumentSupplier) (resource.DocumentBuilderInfo, error) {
	fields, err := resource.NewSearchableDocumentFields(resource.SearchFieldDefinitionsToTableColumns(DashboardSearchFields))
	if err != nil {
		return resource.DocumentBuilderInfo{}, err
	}

	if namespaced == nil {
		namespaced = func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
			return &DashboardDocumentBuilder{
				Namespace:        namespace,
				Blob:             blob,
				Stats:            nil,
				DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{
					// empty values (does not resolve anything)
				}),
			}, nil
		}
	}
	gvr := dashV1.DashboardResourceInfo.GroupVersionResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
			gvr: DashboardSearchFields,
		},
		map[schema.GroupResource]string{
			gvr.GroupResource(): gvr.Version,
		},
	)

	gr := dashV1.DashboardResourceInfo.GroupResource()
	return resource.DocumentBuilderInfo{
		GroupResource:        gr,
		Fields:               fields,
		Namespaced:           namespaced,
		SearchFieldsHash:     provider.IndexAffectingHash(gr.Group, gr.Resource),
		SearchFieldsProvider: provider,
	}, nil
}

type DashboardDocumentBuilder struct {
	// Scoped to a single tenant
	Namespace string

	// Cached stats for this namespace
	// maps dashboard UID to stats
	Stats map[string]map[string]int64

	// data source lookup
	DatasourceLookup dashboard.DatasourceLookup

	// For large dashboards we will need to load them from blob store
	Blob resource.BlobSupport
}

type DashboardStats interface {
	GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error)
	GetDashboardStats(ctx context.Context, namespace, dashboardUid string) (map[string]int64, error)
}

type DashboardStatsLookup = func(ctx context.Context, uid string) map[string]int64

var _ resource.DocumentBuilder = &DashboardDocumentBuilder{}

func (s *DashboardDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	if s.Namespace != "" && s.Namespace != key.Namespace {
		return nil, fmt.Errorf("invalid namespace")
	}

	// Do not unmarshal spec, ReadDashboardWithLogContext already does that for the fields we need
	tmp, err := unmarshalMetadataOnly(value)
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

	summary, err := dashboard.ReadDashboardWithLogContext(bytes.NewReader(value), s.DatasourceLookup, map[string]any{
		"document": fmt.Sprintf("%s/%s/%s/%s", key.GetNamespace(), key.GetGroup(), key.GetResource(), key.GetName()),
		"rv":       rv,
	})
	if err != nil {
		return nil, err
	}
	// metadata name is the dashboard uid
	summary.UID = obj.GetName()
	summary.ID = obj.GetDeprecatedInternalID() // nolint:staticcheck

	doc := resource.NewIndexableDocument(key, rv, obj, summary.Title)
	// TODO: add selectable fields
	doc.Description = summary.Description
	doc.Tags = summary.Tags

	panelTitles := []string{}
	panelTypes := []string{}
	transformations := []string{}
	dsTypes := []string{}

	for p := range summary.PanelIterator() {
		switch p.Type {
		case "": // ignore
		case "row": // row should map to a layout type when we support v2 constructs
		default:
			panelTypes = append(panelTypes, p.Type)
		}

		if len(p.Title) > 0 {
			panelTitles = append(panelTitles, p.Title)
		}
		if len(p.Transformer) > 0 {
			transformations = append(transformations, p.Transformer...)
		}
		if p.LibraryPanel != "" {
			doc.References = append(doc.References, resource.ResourceReference{
				Group:    "dashboard.grafana.app",
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
	if doc.References != nil {
		sort.Sort(doc.References)
	}

	doc.Fields = map[string]any{
		DASHBOARD_SCHEMA_VERSION:        summary.SchemaVersion,
		DASHBOARD_LINK_COUNT:            summary.LinkCount,
		resource.SEARCH_FIELD_LEGACY_ID: summary.ID,
	}

	if len(panelTitles) > 0 {
		doc.Fields[DASHBOARD_PANEL_TITLE] = panelTitles
	}
	if len(panelTypes) > 0 {
		sort.Strings(panelTypes)
		doc.Fields[DASHBOARD_PANEL_TYPES] = slices.Compact(panelTypes) // distinct values
	}
	if len(dsTypes) > 0 {
		sort.Strings(dsTypes)
		doc.Fields[DASHBOARD_DS_TYPES] = slices.Compact(dsTypes) // distinct values
	}
	if len(transformations) > 0 {
		sort.Strings(transformations)
		doc.Fields[DASHBOARD_TRANSFORMATIONS] = slices.Compact(transformations) // distinct values
	}

	for k, v := range s.Stats[summary.UID] {
		doc.Fields[k] = v
	}

	return doc, nil
}

// unmarshalMetadataOnly parses a K8s resource JSON and returns an
// unstructured.Unstructured with only metadata populated (spec is omitted).
// This avoids the cost of recursively parsing the (potentially huge) dashboard specs.
func unmarshalMetadataOnly(data []byte) (*unstructured.Unstructured, error) {
	var partial struct {
		APIVersion string                 `json:"apiVersion"`
		Kind       string                 `json:"kind"`
		Metadata   map[string]interface{} `json:"metadata"`
	}
	if err := json.Unmarshal(data, &partial); err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": partial.APIVersion,
			"kind":       partial.Kind,
			"metadata":   partial.Metadata,
		},
	}, nil
}
