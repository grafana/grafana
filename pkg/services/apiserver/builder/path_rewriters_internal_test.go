package builder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
)

const connectionsPath = "/apis/datasource.grafana.app/v0alpha1/namespaces/default/connections"

func datasourceGroupBuilders() []APIGroupBuilder {
	return []APIGroupBuilder{
		&groupBuilderStub{gv: schema.GroupVersion{Group: datasourceGroup, Version: "v0alpha1"}},
	}
}

func TestPathRewritersForBuilders(t *testing.T) {
	t.Run("rewrites connections onto query when nothing serves the datasource group", func(t *testing.T) {
		got := rewrite(pathRewritersForBuilders(nil), connectionsPath)
		assert.Equal(t, "/apis/query.grafana.app/v0alpha1/namespaces/default/connections", got)
	})

	t.Run("leaves connections alone when a builder serves the datasource group", func(t *testing.T) {
		assert.Equal(t, connectionsPath, rewrite(pathRewritersForBuilders(datasourceGroupBuilders()), connectionsPath))
	})

	t.Run("still rewrites query and sqlschemas when the datasource group is served", func(t *testing.T) {
		rewriters := pathRewritersForBuilders(datasourceGroupBuilders())
		assert.Equal(t, "/apis/query.grafana.app/v0alpha1/namespaces/default/query",
			rewrite(rewriters, "/apis/datasource.grafana.app/v0alpha1/namespaces/default/query"))
		assert.Equal(t, "/apis/query.grafana.app/v0alpha1/namespaces/default/query/sqlschemas",
			rewrite(rewriters, "/apis/datasource.grafana.app/v0alpha1/namespaces/default/sqlschemas"))
	})

	t.Run("does not touch the group's openapi path", func(t *testing.T) {
		const openAPIPath = "/openapi/v3/apis/datasource.grafana.app/v0alpha1"
		assert.Equal(t, openAPIPath, rewrite(pathRewritersForBuilders(nil), openAPIPath))
	})

	t.Run("leaves the shared PathRewriters untouched", func(t *testing.T) {
		pathRewritersForBuilders(datasourceGroupBuilders())
		assert.Equal(t, "/apis/query.grafana.app/v0alpha1/namespaces/default/connections",
			rewrite(PathRewriters, connectionsPath))
	})
}

// rewrite applies the first matching rewriter, mirroring filters.WithPathRewriters.
func rewrite(rewriters []filters.PathRewriter, path string) string {
	for _, r := range rewriters {
		if newPath, ok := r.Rewrite(path); ok {
			return newPath
		}
	}
	return path
}

type groupBuilderStub struct {
	gv schema.GroupVersion
}

var (
	_ APIGroupBuilder         = (*groupBuilderStub)(nil)
	_ APIGroupVersionProvider = (*groupBuilderStub)(nil)
)

func (b *groupBuilderStub) GetGroupVersion() schema.GroupVersion { return b.gv }
func (b *groupBuilderStub) InstallSchema(*runtime.Scheme) error  { return nil }
func (b *groupBuilderStub) AllowedV0Alpha1Resources() []string   { return nil }
func (b *groupBuilderStub) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, APIGroupOptions) error {
	return nil
}
func (b *groupBuilderStub) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
