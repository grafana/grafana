package builder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type manifestTestBuilder struct {
	gvs []schema.GroupVersion
}

func (b *manifestTestBuilder) GetGroupVersions() []schema.GroupVersion { return b.gvs }
func (b *manifestTestBuilder) InstallSchema(*runtime.Scheme) error     { return nil }
func (b *manifestTestBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, APIGroupOptions) error {
	return nil
}
func (b *manifestTestBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (b *manifestTestBuilder) AllowedV0Alpha1Resources() []string                  { return nil }

type manifestResourceBuilder struct {
	*manifestTestBuilder
	infos map[schema.GroupVersion][]utils.ResourceInfo
}

func (b *manifestResourceBuilder) GetResourceInfos(gv schema.GroupVersion) []utils.ResourceInfo {
	return b.infos[gv]
}

func TestManifestsFromBuilders(t *testing.T) {
	v1 := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	v2 := schema.GroupVersion{Group: "example.grafana.app", Version: "v2"}
	widget := utils.NewResourceInfo("ignored.example", "ignored", "widgets", "widget", "Widget", nil, nil, utils.TableColumns{})
	cluster := utils.NewResourceInfo("ignored.example", "ignored", "clusters", "cluster", "Cluster", nil, nil, utils.TableColumns{})
	cluster = cluster.WithClusterScope()
	b := &manifestResourceBuilder{
		manifestTestBuilder: &manifestTestBuilder{gvs: []schema.GroupVersion{v1, v2}},
		infos: map[schema.GroupVersion][]utils.ResourceInfo{
			v1: {widget},
			v2: {cluster},
		},
	}

	manifests := ManifestsFromBuilders([]APIGroupBuilder{b, &manifestTestBuilder{gvs: []schema.GroupVersion{v1}}})

	require.Len(t, manifests, 2, "builders without resource declarations add no manifests")
	assert.Equal(t, v1.Group, manifests[0].Group)
	assert.Equal(t, v1.Version, manifests[0].PreferredVersion)
	require.Len(t, manifests[0].Versions, 1)
	assert.Equal(t, v1.Version, manifests[0].Versions[0].Name)
	assert.True(t, manifests[0].Versions[0].Served)
	assert.Equal(t, "Widget", manifests[0].Versions[0].Kinds[0].Kind)
	assert.Equal(t, "widgets", manifests[0].Versions[0].Kinds[0].Plural)
	assert.Equal(t, "Namespaced", manifests[0].Versions[0].Kinds[0].Scope)

	assert.Equal(t, v2.Group, manifests[1].Group)
	assert.Equal(t, v2.Version, manifests[1].PreferredVersion)
	assert.Equal(t, "Cluster", manifests[1].Versions[0].Kinds[0].Scope)
}
