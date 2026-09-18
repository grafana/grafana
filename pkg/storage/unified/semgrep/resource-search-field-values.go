//go:build ignore

package semgreptest

import resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"

func missing() *resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{Limit: 10}
}

func unspecified() *resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{
		ResultFormat: resourcepb.ResourceSearchRequest_UNSPECIFIED,
	}
}

func table() *resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{
		ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
	}
}

func dynamic(format resourcepb.ResourceSearchRequest_ResultFormat) *resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{ResultFormat: format}
}

func allocated() *resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-requires-field-values
	return new(resourcepb.ResourceSearchRequest)
}

func declared() resourcepb.ResourceSearchRequest {
	// ruleid: resource-search-requires-field-values
	var request resourcepb.ResourceSearchRequest
	return request
}

func fieldValues() *resourcepb.ResourceSearchRequest {
	// ok: resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
}
