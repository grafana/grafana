package appsdk

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
)

// plainOptsGetter implements only generic.RESTOptionsGetter, which is all a
// storage backend has ever had to implement.
type plainOptsGetter struct {
	// asked records the GroupResources CompleteWithOptions resolved through this
	// getter, which is all the k8s interface can report.
	asked []schema.GroupResource
}

func (g *plainOptsGetter) GetRESTOptions(gr schema.GroupResource, _ runtime.Object) (generic.RESTOptions, error) {
	g.asked = append(g.asked, gr)
	return generic.RESTOptions{
		ResourcePrefix: "/group/" + gr.Group + "/resource/" + gr.Resource,
		StorageConfig:  &storagebackend.ConfigForResource{GroupResource: gr},
		Decorator: func(
			*storagebackend.ConfigForResource,
			string,
			func(runtime.Object) (string, error),
			func() runtime.Object,
			func() runtime.Object,
			storage.AttrFunc,
			storage.IndexerFuncs,
			*cache.Indexers,
		) (storage.Interface, factory.DestroyFunc, error) {
			return nil, func() {}, nil
		},
	}, nil
}

// scopingOptsGetter also implements RESTOptionsGetterForResource, recording the
// GroupVersionResources it is scoped to.
type scopingOptsGetter struct {
	*plainOptsGetter

	// scoped is shared with every getter ForResource hands back, so one recorder
	// sees every resource the installer builds.
	scoped *[]schema.GroupVersionResource

	// decline makes ForResource return nil, opting out of scoping.
	decline bool
}

func newScopingOptsGetter() *scopingOptsGetter {
	return &scopingOptsGetter{plainOptsGetter: &plainOptsGetter{}, scoped: &[]schema.GroupVersionResource{}}
}

func (g *scopingOptsGetter) ForResource(gvr schema.GroupVersionResource) generic.RESTOptionsGetter {
	if g.decline {
		return nil
	}
	*g.scoped = append(*g.scoped, gvr)
	return g
}

func TestRESTOptionsGetterForResource(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "test.ext.grafana.app", Version: "v1alpha1", Resource: "tests"}

	t.Run("a getter that does not implement the interface is used unchanged", func(t *testing.T) {
		plain := &plainOptsGetter{}
		assert.Same(t, plain, restOptionsGetterForResource(plain, gvr))
	})

	t.Run("a scoping getter is asked for the resource", func(t *testing.T) {
		scoping := newScopingOptsGetter()
		assert.Same(t, scoping, restOptionsGetterForResource(scoping, gvr))
		assert.Equal(t, []schema.GroupVersionResource{gvr}, *scoping.scoped)
	})

	t.Run("a scoping getter that declines keeps the original", func(t *testing.T) {
		scoping := newScopingOptsGetter()
		scoping.decline = true
		assert.Same(t, scoping, restOptionsGetterForResource(scoping, gvr))
		assert.Empty(t, *scoping.scoped)
	})

	t.Run("a nil getter is passed through rather than asked", func(t *testing.T) {
		assert.Nil(t, restOptionsGetterForResource(nil, gvr))
	})
}

// Every served version of a kind installs its own store against the one shared
// GroupResource, and GetRESTOptions is told only that GroupResource -- so a
// backend that configures storage per resource can only tell the versions apart
// if the installer scopes the getter first.
func TestDefaultInstaller_InstallAPIsScopesOptionsPerVersion(t *testing.T) {
	const (
		group   = "test.ext.grafana.app"
		kindStr = "Test"
		plural  = "tests"
	)
	versions := []string{"v1alpha1", "v2alpha1"}

	manifestVersions := make([]app.ManifestVersion, 0, len(versions))
	for _, v := range versions {
		manifestVersions = append(manifestVersions, app.ManifestVersion{
			Name:   v,
			Served: true,
			Kinds:  []app.ManifestVersionKind{{Kind: kindStr, Plural: plural}},
		})
	}

	installer, err := NewDefaultAppInstaller(
		simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{
			Group:    group,
			Versions: manifestVersions,
		}), nil, nil),
		app.Config{},
		&mockGoTypeResolver{
			// Resolve each version to a Kind of that version, as generated code does.
			KindToGoTypeFunc: func(kind, ver string) (resource.Kind, bool) {
				return resource.Kind{
					Schema: resource.NewSimpleSchema(group, ver, &resource.UntypedObject{}, &resource.UntypedList{},
						resource.WithKind(kind), resource.WithPlural(plural)),
					Codecs: map[resource.KindEncoding]resource.Codec{
						resource.KindEncodingJSON: resource.NewJSONCodec(),
					},
				}, true
			},
		})
	require.Nil(t, err)

	getter := newScopingOptsGetter()
	require.Nil(t, installer.InstallAPIs(&MockGenericAPIServer{}, getter))

	assert.ElementsMatch(t, []schema.GroupVersionResource{
		{Group: group, Version: "v1alpha1", Resource: plural},
		{Group: group, Version: "v2alpha1", Resource: plural},
	}, *getter.scoped, "each version's store is scoped to the version it serves")

	// What the getter would have had to work from without scoping: the same
	// GroupResource twice, with nothing to tell the two versions apart.
	assert.Equal(t, []schema.GroupResource{
		{Group: group, Resource: plural},
		{Group: group, Resource: plural},
	}, getter.asked)
}
