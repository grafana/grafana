//go:build ignore

package resource

import "github.com/grafana/grafana/pkg/storage/unified/resourcepb"

func semgrepCIProbe() *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{Limit: 10}
}
