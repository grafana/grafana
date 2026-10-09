package model

import (
	"context"
	"fmt"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// AsResourceKey converts the given namespace and type to a search key
func AsResourceKey(ns string, t string) (*resourcepb.ResourceKey, error) {
	if ns == "" {
		return nil, fmt.Errorf("missing namespace")
	}
	switch t {
	case "folders", "folder":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     folders.GROUP,
			Resource:  folders.RESOURCE,
		}, nil
	case "dashboards", "dashboard":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     dashboardv1.GROUP,
			Resource:  dashboardv1.DASHBOARD_RESOURCE,
		}, nil

	// NOT really supported in the dashboard search UI, but useful for manual testing
	case "playlist", "playlists":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
		}, nil
	}

	return nil, fmt.Errorf("unknown resource type")
}

func NewTestDocumentBuilder() DocumentBuilder {
	return &testDocumentBuilder{}
}

// testDocumentBuilder implements DocumentBuilder for testing
type testDocumentBuilder struct{}

func (b *testDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*IndexableDocument, error) {
	// convert value to unstructured.Unstructured
	var u unstructured.Unstructured
	if err := u.UnmarshalJSON(value); err != nil {
		return nil, fmt.Errorf("failed to unmarshal value: %w", err)
	}

	title := ""
	tags := []string{}
	val := ""

	spec, ok, _ := unstructured.NestedMap(u.Object, "spec")
	if ok {
		if v, ok := spec["title"]; ok {
			title = v.(string)
		}
		if v, ok := spec["tags"]; ok {
			if tagSlice, ok := v.([]interface{}); ok {
				tags = make([]string, len(tagSlice))
				for i, tag := range tagSlice {
					if strTag, ok := tag.(string); ok {
						tags[i] = strTag
					}
				}
			}
		}
		if v, ok := spec["value"]; ok {
			val = v.(string)
		}
	}
	return &IndexableDocument{
		Key: &resourcepb.ResourceKey{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
			Name:      u.GetName(),
		},
		Title: title,
		Tags:  tags,
		Fields: map[string]interface{}{
			"title": title,
			"value": val,
		},
	}, nil
}

// TestDocumentBuilderSupplier implements DocumentBuilderSupplier for testing
type TestDocumentBuilderSupplier struct {
	GroupsResources map[string]string
}

func (s *TestDocumentBuilderSupplier) GetDocumentBuilders(_ *SearchFieldsRegistry) ([]DocumentBuilderInfo, error) {
	builders := make([]DocumentBuilderInfo, 0, len(s.GroupsResources))

	// Add builders for all possible group/resource combinations
	for group, resourceType := range s.GroupsResources {
		builders = append(builders, DocumentBuilderInfo{
			GroupResource: schema.GroupResource{
				Group:    group,
				Resource: resourceType,
			},
			Builder: &testDocumentBuilder{},
		})
	}

	return builders, nil
}
