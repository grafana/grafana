//go:build ignore

package semgreptest

import resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"

func missing() *resourcepb.ResourceSearchRequest {
	// ruleid: direct-go-resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{Limit: 10}
}

func unspecified() *resourcepb.ResourceSearchRequest {
	// ruleid: direct-go-resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{
		ResultFormat: resourcepb.ResourceSearchRequest_UNSPECIFIED,
	}
}

func table() *resourcepb.ResourceSearchRequest {
	// ruleid: direct-go-resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{
		ResultFormat: resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
	}
}

func dynamic(format resourcepb.ResourceSearchRequest_ResultFormat) *resourcepb.ResourceSearchRequest {
	// ruleid: direct-go-resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{ResultFormat: format}
}

func allocated() *resourcepb.ResourceSearchRequest {
	// ruleid: direct-go-resource-search-requires-field-values
	return new(resourcepb.ResourceSearchRequest)
}

func declared() resourcepb.ResourceSearchRequest {
	// ruleid: direct-go-resource-search-requires-field-values
	var request resourcepb.ResourceSearchRequest
	return request
}

func groupedDeclaration() resourcepb.ResourceSearchRequest {
	var (
		// ruleid: direct-go-resource-search-requires-field-values
		request resourcepb.ResourceSearchRequest // trailing comment
	)
	request.ResultFormat = resourcepb.ResourceSearchRequest_FIELD_VALUES
	return request
}

func fieldValues() *resourcepb.ResourceSearchRequest {
	// ok: direct-go-resource-search-requires-field-values
	return &resourcepb.ResourceSearchRequest{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
}
