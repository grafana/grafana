package builder

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

// fakeBuilder satisfies the real APIGroupBuilder interface (common.go:30-50: InstallSchema,
// UpdateAPIGroupInfo, GetOpenAPIDefinitions, AllowedV0Alpha1Resources) plus
// APIGroupVersionProvider (GetGroupVersion, common.go:54-56), which GetGroupVersions needs.
// isGetter controls whether it also implements APIGroupGetter, to exercise both branches of
// ExtractGetters' type assertion.
type fakeBuilder struct {
	gv       schema.GroupVersion
	isGetter bool
	obj      runtime.Object
}

func (f *fakeBuilder) InstallSchema(*runtime.Scheme) error { return nil }
func (f *fakeBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, APIGroupOptions) error {
	return nil
}
func (f *fakeBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (f *fakeBuilder) AllowedV0Alpha1Resources() []string                 { return nil }
func (f *fakeBuilder) GetGroupVersion() schema.GroupVersion                { return f.gv }

// getterBuilder embeds fakeBuilder and adds Get, so only builders constructed as
// *getterBuilder satisfy APIGroupGetter - a plain *fakeBuilder does not.
type getterBuilder struct {
	fakeBuilder
}

func (g *getterBuilder) Get(_ context.Context, _, _ string) (runtime.Object, error) {
	return g.obj, nil
}

func TestExtractGetters(t *testing.T) {
	getterGV := schema.GroupVersion{Group: "getter.example.com", Version: "v1"}
	nonGetterGV := schema.GroupVersion{Group: "nongetter.example.com", Version: "v1"}

	withGetter := &getterBuilder{fakeBuilder: fakeBuilder{gv: getterGV}}
	withoutGetter := &fakeBuilder{gv: nonGetterGV}

	getters := ExtractGetters([]APIGroupBuilder{withGetter, withoutGetter})

	require.Len(t, getters, 1)
	g, ok := getters[getterGV]
	require.True(t, ok, "expected an entry for the GV whose builder implements APIGroupGetter")
	require.Same(t, withGetter, g)

	_, ok = getters[nonGetterGV]
	require.False(t, ok, "a builder that doesn't implement APIGroupGetter must not get an entry")
}
