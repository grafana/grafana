package query

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// annotatedConnections adds the annotations stored on the datasource resources in
// unified storage to the connections of the wrapped provider.
type annotatedConnections struct {
	next   datasourceV0.DataSourceConnectionProvider
	client resource.ResourceClient
	log    log.Logger
}

func newAnnotatedConnections(next datasourceV0.DataSourceConnectionProvider, client resource.ResourceClient) *annotatedConnections {
	return &annotatedConnections{next: next, client: client, log: log.New("query_apiserver.connections")}
}

func (p *annotatedConnections) ListConnections(ctx context.Context, query datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	list, err := p.next.ListConnections(ctx, query)
	if err != nil {
		return nil, err
	}

	stored, err := p.listAnnotations(ctx, query.Namespace)
	if err != nil {
		// Annotations are an enrichment, the connections themselves are still valid
		p.log.FromContext(ctx).Warn("failed to read datasource annotations from unified storage", "error", err)
		return list, nil
	}

	for i := range list.Items {
		extra := stored[list.Items[i].Name]
		if len(extra) == 0 {
			continue
		}
		merged := make(map[string]string, len(list.Items[i].Annotations)+len(extra))
		maps.Copy(merged, list.Items[i].Annotations)
		maps.Copy(merged, extra) // the stored resource wins over what is derived from the legacy row
		list.Items[i].Annotations = merged
	}
	return list, nil
}

// listAnnotations returns the annotations of every datasource the caller can list, by name.
// All datasource types share one collection, so a single list covers them.
func (p *annotatedConnections) listAnnotations(ctx context.Context, namespace string) (map[string]map[string]string, error) {
	gr := datasourceV0.DataSourceResourceInfo.GroupResource()
	req := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     gr.Group,
				Resource:  gr.Resource,
			},
		},
	}

	result := map[string]map[string]string{}
	for {
		rsp, err := p.client.List(ctx, req)
		if err = resource.ErrorFromResponse(rsp.GetError(), err); err != nil {
			return nil, err
		}
		for _, item := range rsp.Items {
			var obj metav1.PartialObjectMetadata
			if err := json.Unmarshal(item.Value, &obj); err != nil {
				return nil, fmt.Errorf("failed to decode datasource: %w", err)
			}
			if len(obj.Annotations) > 0 {
				result[obj.Name] = obj.Annotations
			}
		}
		if rsp.NextPageToken == "" {
			return result, nil
		}
		req.NextPageToken = rsp.NextPageToken
	}
}
