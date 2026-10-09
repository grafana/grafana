//go:build ignore

package semgreptest

import resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"

func responseLiteral(table *resourcepb.ResourceTable) *resourcepb.ResourceSearchResponse {
	// ruleid: resource-search-no-table-producers
	return &resourcepb.ResourceSearchResponse{Results: table}
}

func responseFormatLiteral() *resourcepb.ResourceSearchResponse {
	// ruleid: resource-search-no-table-producers
	return &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
	}
}

func responseAssigned(response *resourcepb.ResourceSearchResponse, table *resourcepb.ResourceTable) {
	// ruleid: resource-search-no-table-producers
	response.Results = table
}

func responseValueAssigned(response resourcepb.ResourceSearchResponse, table *resourcepb.ResourceTable) {
	// ruleid: resource-search-no-table-producers
	response.Results = table
}

func responseFormatAssigned(response *resourcepb.ResourceSearchResponse) {
	// ruleid: resource-search-no-table-producers
	response.ResultFormat = resourcepb.ResourceSearchRequest_RESOURCE_TABLE
}

func responseValueFormatAssigned(response resourcepb.ResourceSearchResponse) {
	// ruleid: resource-search-no-table-producers
	response.ResultFormat = resourcepb.ResourceSearchRequest_RESOURCE_TABLE
}

func fieldValuesResponse() *resourcepb.ResourceSearchResponse {
	// ok: resource-search-no-table-producers
	return &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields:       []*resourcepb.ResourceSearchField{},
		Rows:         []*resourcepb.ResourceSearchRow{},
	}
}

type otherResponse struct {
	Results []string
}

func unrelatedResponse(response *otherResponse) {
	// ok: resource-search-no-table-producers
	response.Results = []string{"ok"}
}
