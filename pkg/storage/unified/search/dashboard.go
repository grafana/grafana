package search

import (
	"bytes"
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type DashboardDocument struct {
	StandardDocumentFields `json:",inline"`

	SchemaVersion   int64    `json:"schema_version,omitempty"`
	LinkCount       int64    `json:"link_count,omitempty"`
	PanelTypes      []string `json:"panel_type,omitempty"`
	Transformations []string `json:"transformation,omitempty"`
	DataSources     []string `json:"ds,omitempty"`
	DataSourceTypes []string `json:"ds_type,omitempty"`

	// Sortable stats
	Stats map[string]int64 `json:"stats,omitempty"`
}

type DashboardDocumentBuilder struct {
	// Scoped to a single tenant
	Namespace string

	// Cached stats for this namespace
	// TODO, load this from apiserver request
	Stats map[string]map[string]int64

	// data source lookup
	Lookup dashboard.DatasourceLookup

	// For large dashboards we will need to load them from blob store
	Blob resource.BlobSupport
}

var _ resource.DocumentBuilder = &DashboardDocumentBuilder{}

func (s *DashboardDocumentBuilder) BuildDocument(ctx context.Context, key *resource.ResourceKey, rv int64, value []byte) (resource.IndexableDocument, error) {
	if s.Namespace != key.Namespace {
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

	summary, err := dashboard.ReadDashboard(bytes.NewReader(value), s.Lookup)
	if err != nil {
		return nil, err
	}

	doc := &DashboardDocument{
		Stats: s.Stats[key.Name],
	}
	doc.Load(key, rv, obj)

	doc.Title = summary.Title
	doc.Description = summary.Description
	doc.Tags = summary.Tags
	doc.SchemaVersion = summary.SchemaVersion
	doc.LinkCount = summary.LinkCount
	doc.ByteSize = len(value)

	for _, p := range summary.Panels {
		if p.Type != "" {
			doc.PanelTypes = append(doc.PanelTypes, p.Type)
		}
		if len(p.Transformer) > 0 {
			doc.Transformations = append(doc.Transformations, p.Transformer...)
		}
	}

	for _, ds := range summary.Datasource {
		doc.DataSourceTypes = append(doc.DataSourceTypes, ds.Type)
		doc.DataSources = append(doc.DataSources, fmt.Sprintf("%s/%s", ds.Type, ds.UID)) // should be group+name
	}

	return doc, nil
}
