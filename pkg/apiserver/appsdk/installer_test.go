package appsdk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	endpointmetrics "k8s.io/apiserver/pkg/endpoints/metrics"
	genericapiserver "k8s.io/apiserver/pkg/server"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/component-base/metrics/legacyregistry"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
)

func TestDefaultInstaller_AddToScheme(t *testing.T) {
	t.Run("nil scheme", func(t *testing.T) {
		installer := defaultInstaller{}
		err := installer.AddToScheme(nil)
		assert.Equal(t, errors.New("scheme cannot be nil"), err)
	})

	t.Run("unresolvable kind", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(&simple.AppProvider{
			AppManifest: app.NewEmbeddedManifest(app.ManifestData{
				Group: "test.ext.grafana.com",
				Versions: []app.ManifestVersion{{
					Name: "v1",
					Kinds: []app.ManifestVersionKind{{
						Kind: "Foo",
					}},
				}},
			}),
		}, app.Config{}, &mockGoTypeResolver{
			KindToGoTypeFunc: func(kind, ver string) (resource.Kind, bool) {
				return resource.Kind{}, false
			},
		})
		require.Nil(t, err)
		scheme := newScheme()
		err = installer.AddToScheme(scheme)
		assert.Equal(t, fmt.Errorf("failed to get kinds by group version: %w", errors.New("failed to resolve kind Foo")), err)
	})

	t.Run("success", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(&simple.AppProvider{
			AppManifest: app.NewEmbeddedManifest(app.ManifestData{
				Group: TestKind.Group(),
				Versions: []app.ManifestVersion{{
					Name: TestKind.Version(),
					Kinds: []app.ManifestVersionKind{{
						Kind:   TestKind.Kind(),
						Plural: TestKind.Plural(),
					}},
				}},
			}),
		}, app.Config{}, &mockGoTypeResolver{
			KindToGoTypeFunc: func(kind, ver string) (resource.Kind, bool) {
				return TestKind, true
			},
		})
		require.Nil(t, err)
		scheme := newScheme()
		err = installer.AddToScheme(scheme)
		assert.Nil(t, err)
		known := scheme.KnownTypes(schema.GroupVersion{Group: TestKind.Group(), Version: TestKind.Version()})
		// 10 => Object, List, CreateOptions, GetOptions, UpdateOptions, DeleteOptions, ListOptions, PatchOptions, WatchEvent, ResourceCallOptions
		assert.Equal(t, 10, len(known))
		testKindVal, ok := known[TestKind.Kind()]
		require.True(t, ok)
		assert.Equal(t, reflect.TypeFor[resource.UntypedObject](), testKindVal)
		testKindListVal, ok := known[TestKind.Kind()+"List"]
		require.True(t, ok)
		assert.Equal(t, reflect.TypeFor[resource.UntypedList](), testKindListVal)
	})
}

func TestDefaultInstaller_GetOpenAPIDefinitions(t *testing.T) {
	sch1, err := app.VersionSchemaFromMap(map[string]any{
		"spec": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"foo": map[string]any{
					"type": "string",
				},
			},
		},
	}, TestKind.Kind())
	fooSch := spec.Schema{
		SchemaProps: spec.SchemaProps{
			ID: "foo",
		},
	}
	kind := TestKind
	require.Nil(t, err)
	md := app.ManifestData{
		Group: kind.Group(),
		Versions: []app.ManifestVersion{{
			Name: kind.Version(),
			Kinds: []app.ManifestVersionKind{{
				Kind:   kind.Kind(),
				Schema: sch1,
				Routes: map[string]spec3.PathProps{
					"/foo": {
						Get: &spec3.Operation{
							OperationProps: spec3.OperationProps{
								Responses: &spec3.Responses{
									ResponsesProps: spec3.ResponsesProps{
										Default: &spec3.Response{
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &fooSch,
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			}},
		}},
	}
	refCallback := func(path string) spec.Ref {
		ref, _ := spec.NewRef(path)
		return ref
	}
	expected := make(map[string]common.OpenAPIDefinition)
	oapi1, err := md.Versions[0].Kinds[0].Schema.AsKubeOpenAPI(kind.GroupVersionKind(), refCallback, ToOpenAPIName("github.com/grafana/grafana-app-sdk/resource"))
	require.Nil(t, err)
	maps.Copy(expected, oapi1)
	maps.Copy(expected, GetResourceCallOptionsOpenAPIDefinition())
	expected["com.github.grafana.grafana.pkg.apiserver.appsdk.getFooResponse"] = common.OpenAPIDefinition{
		Schema: fooSch,
	}
	expected[ToOpenAPIName("github.com/grafana/grafana/pkg/apiserver/appsdk.EmptyObject")] = common.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "EmptyObject defines a model for a missing object type",
				Type:        []string{"object"},
			},
		},
	}

	installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, &mockGoTypeResolver{
		KindToGoTypeFunc: func(k, v string) (resource.Kind, bool) {
			assert.Equal(t, TestKind.Kind(), k)
			assert.Equal(t, TestKind.Version(), v)
			return kind, true
		},
		CustomRouteReturnGoTypeFunc: func(k, version, path, verb string) (goType any, exists bool) {
			assert.Equal(t, TestKind.Kind(), k)
			assert.Equal(t, TestKind.Version(), version)
			assert.Equal(t, "/foo", path)
			return getFooResponse{}, true
		},
	})
	require.Nil(t, err)
	scheme := newScheme()
	require.Nil(t, installer.AddToScheme(scheme))
	res := installer.GetOpenAPIDefinitions(refCallback)
	require.Equal(t, len(expected), len(res))
	assert.Equal(t, expected, res)
	options, _, _ := (&SubresourceConnector{}).NewConnectOptions()
	optionsName := util.GetCanonicalTypeName(options)
	assert.Equal(t, "com.github.grafana.grafana.pkg.apiserver.appsdk.ResourceCallOptions", optionsName)
	require.Contains(t, res, optionsName)
	assert.Contains(t, res[optionsName].Schema.Properties, "path")
}

// TestEmptyObject_OpenAPIDefinitionKeyMatchesModelName guards the invariant
// that EmptyObject's OpenAPI definition is registered under the same key the
// builder uses to look it up (its OpenAPIModelName()). A mismatch produces a
// dangling $ref in the served OpenAPI document for custom routes that fall
// back to EmptyObject as their response type.
func TestEmptyObject_OpenAPIDefinitionKeyMatchesModelName(t *testing.T) {
	sch, err := app.VersionSchemaFromMap(map[string]any{
		"spec": map[string]any{"type": "object"},
	}, TestKind.Kind())
	require.Nil(t, err)
	md := app.ManifestData{
		Group: TestKind.Group(),
		Versions: []app.ManifestVersion{{
			Name: TestKind.Version(),
			Kinds: []app.ManifestVersionKind{{
				Kind:   TestKind.Kind(),
				Schema: sch,
				Routes: map[string]spec3.PathProps{
					"/foo": {Get: &spec3.Operation{}},
				},
			}},
		}},
	}
	installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, &mockGoTypeResolver{
		KindToGoTypeFunc: func(k, v string) (resource.Kind, bool) {
			return TestKind, true
		},
	})
	require.Nil(t, err)
	scheme := newScheme()
	require.Nil(t, installer.AddToScheme(scheme))
	defs := installer.GetOpenAPIDefinitions(func(path string) spec.Ref {
		ref, _ := spec.NewRef(path)
		return ref
	})
	_, ok := defs[EmptyObject{}.OpenAPIModelName()]
	assert.True(t, ok, "EmptyObject must be registered in GetOpenAPIDefinitions under its OpenAPIModelName %q", EmptyObject{}.OpenAPIModelName())
}

type getFooResponse struct{}

func TestDefaultInstaller_InstallAPIs(t *testing.T) {
	md := app.ManifestData{
		Versions: []app.ManifestVersion{{
			Name:   TestKind.Version(),
			Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind:   TestKind.Kind(),
				Plural: TestKind.Plural(),
				Admission: &app.AdmissionCapabilities{
					Validation: &app.ValidationCapability{
						Operations: []app.AdmissionOperation{app.AdmissionOperationAny},
					},
				},
				Routes: map[string]spec3.PathProps{
					"/foo": {
						Get: &spec3.Operation{},
					},
				},
			}},
		}},
	}

	t.Run("error adding to scheme", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, &mockGoTypeResolver{
			KindToGoTypeFunc: func(kind, ver string) (resource.Kind, bool) {
				return TestKind, false
			},
		})
		require.Nil(t, err)
		err = installer.InstallAPIs(nil, nil)
		assert.NotNil(t, err)
		assert.EqualError(t, err, "failed to add to scheme: failed to get kinds by group version: failed to resolve kind Test")
	})

	t.Run("error getting groupversions", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, &mockGoTypeResolver{
			KindToGoTypeFunc: func(kind, ver string) (resource.Kind, bool) {
				return TestKind, false
			},
		})
		require.Nil(t, err)
		installer.scheme = newScheme()
		err = installer.InstallAPIs(nil, nil)
		assert.NotNil(t, err)
		assert.EqualError(t, err, "failed to get kinds by group version: failed to resolve kind Test")
	})

	t.Run("error creating store", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, &mockGoTypeResolver{
			KindToGoTypeFunc: func(kind, ver string) (resource.Kind, bool) {
				return TestKind, true
			},
		})
		require.Nil(t, err)
		err = installer.InstallAPIs(nil, nil)
		assert.NotNil(t, err)
		assert.EqualError(t, err, "failed to create store for kind Test: failed completing storage options for Test: options for tests.test.ext.grafana.app must have RESTOptions set")
	})
}

func TestDefaultInstaller_SubresourceRouteNotFound(t *testing.T) {
	md := app.ManifestData{
		Group: TestKind.Group(),
		Versions: []app.ManifestVersion{{
			Name: TestKind.Version(), Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind: TestKind.Kind(), Plural: TestKind.Plural(),
				Routes: map[string]spec3.PathProps{"/foo": {Get: &spec3.Operation{}}},
			}},
		}},
	}
	installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, &mockGoTypeResolver{
		KindToGoTypeFunc: func(string, string) (resource.Kind, bool) { return TestKind, true },
	})
	require.NoError(t, err)
	installer.app = &MockApp{CallCustomRouteFunc: func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
		return fmt.Errorf("route lookup: %w", app.ErrCustomRouteNotFound)
	}}
	var connector *SubresourceConnector
	server := &MockGenericAPIServer{InstallAPIGroupFunc: func(info *genericapiserver.APIGroupInfo) error {
		connector = info.VersionedResourcesStorageMap[TestKind.Version()][TestKind.Plural()+"/foo"].(*SubresourceConnector)
		return nil
	}}
	require.NoError(t, installer.InstallAPIs(server, &plainOptsGetter{}))
	require.NotNil(t, connector)
	h := handlerWrapper{
		id:        resource.FullIdentifier{Name: "example"},
		handler:   connector.Route.Handler,
		urlToPath: func(u *url.URL) string { return u.Path },
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/foo", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
	var status metav1.Status
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &status))
	assert.Equal(t, metav1.TypeMeta{Kind: "Status", APIVersion: "v1"}, status.TypeMeta)
	assert.Equal(t, metav1.StatusFailure, status.Status)
	assert.Equal(t, int32(http.StatusNotFound), status.Code)
	assert.Equal(t, metav1.StatusReasonNotFound, status.Reason)
	assert.Contains(t, status.Message, "subresource 'foo' not found")
	assert.Equal(t, &metav1.StatusDetails{Group: TestKind.Group(), Kind: TestKind.Kind(), Name: "example"}, status.Details)
}

func TestCopySpecSchema_PatternProperties(t *testing.T) {
	for _, withProperties := range []bool{false, true} {
		t.Run(fmt.Sprintf("with properties=%t", withProperties), func(t *testing.T) {
			in := spec.Schema{SchemaProps: spec.SchemaProps{
				PatternProperties: map[string]spec.Schema{
					"^x-": {SchemaProps: spec.SchemaProps{Type: []string{"string"}}},
				},
			}}
			if withProperties {
				in.Properties = map[string]spec.Schema{"name": {SchemaProps: spec.SchemaProps{Type: []string{"string"}}}}
			}
			out := copySpecSchema(&in)
			require.Equal(t, in, out)
			out.PatternProperties["^x-"].Type[0] = "number"
			assert.Equal(t, "string", in.PatternProperties["^x-"].Type[0])
			delete(out.PatternProperties, "^x-")
			assert.Contains(t, in.PatternProperties, "^x-")
		})
	}
}

func TestDefaultInstaller_AdmissionPlugin(t *testing.T) {
	t.Run("no admission control", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{}), nil, nil), app.Config{}, nil)
		require.Nil(t, err)
		plugin := installer.AdmissionPlugin()
		assert.Nil(t, plugin)
	})

	t.Run("validation", func(t *testing.T) {
		md := app.ManifestData{
			Versions: []app.ManifestVersion{{
				Name:   TestKind.Version(),
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   TestKind.Kind(),
					Plural: TestKind.Plural(),
					Admission: &app.AdmissionCapabilities{
						Validation: &app.ValidationCapability{
							Operations: []app.AdmissionOperation{app.AdmissionOperationAny},
						},
					},
				}},
			}},
		}
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, nil)
		require.Nil(t, err)
		plugin := installer.AdmissionPlugin()
		assert.NotNil(t, plugin)
		adm, err := plugin(nil)
		require.Nil(t, err)
		appAdm, ok := adm.(*appAdmission)
		require.True(t, ok)
		assert.Equal(t, md, appAdm.manifestData)
	})

	t.Run("mutation", func(t *testing.T) {
		md := app.ManifestData{
			Versions: []app.ManifestVersion{{
				Name:   TestKind.Version(),
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   TestKind.Kind(),
					Plural: TestKind.Plural(),
					Admission: &app.AdmissionCapabilities{
						Mutation: &app.MutationCapability{
							Operations: []app.AdmissionOperation{app.AdmissionOperationAny},
						},
					},
				}},
			}},
		}
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), nil, nil), app.Config{}, nil)
		require.Nil(t, err)
		plugin := installer.AdmissionPlugin()
		assert.NotNil(t, plugin)
		adm, err := plugin(nil)
		require.Nil(t, err)
		appAdm, ok := adm.(*appAdmission)
		require.True(t, ok)
		assert.Equal(t, md, appAdm.manifestData)
	})
}

func TestDefaultInstaller_InitializeApp(t *testing.T) {
	t.Run("error", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{}), nil, func(cfg app.Config) (app.App, error) {
			return nil, errors.New("I AM ERROR")
		}), app.Config{}, nil)
		require.Nil(t, err)
		err = installer.InitializeApp(clientrest.Config{})
		assert.Equal(t, errors.New("I AM ERROR"), err)
	})

	t.Run("already initialized", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{}), nil, func(cfg app.Config) (app.App, error) {
			return nil, errors.New("I AM ERROR")
		}), app.Config{}, nil)
		require.Nil(t, err)
		installer.app = &MockApp{}
		err = installer.InitializeApp(clientrest.Config{})
		assert.Equal(t, ErrAppAlreadyInitialized, err)
	})

	t.Run("success", func(t *testing.T) {
		md := app.ManifestData{
			AppName: "test-app",
		}
		rcfg := clientrest.Config{
			Host: "foo",
		}
		initCalled := false
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(md), "foo", func(cfg app.Config) (app.App, error) {
			assert.Equal(t, "foo", cfg.SpecificConfig)
			assert.Equal(t, md, cfg.ManifestData)
			assert.Equal(t, rcfg, cfg.KubeConfig)
			initCalled = true
			return &MockApp{}, nil
		}), app.Config{}, nil)
		require.Nil(t, err)
		err = installer.InitializeApp(rcfg)
		require.Nil(t, err)
		assert.True(t, initCalled)
	})
}

func TestDefaultInstaller_App(t *testing.T) {
	t.Run("uninitialized", func(t *testing.T) {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{}), nil, nil), app.Config{}, nil)
		require.Nil(t, err)
		app, err := installer.App()
		assert.Nil(t, app)
		assert.Equal(t, ErrAppNotInitialized, err)
	})

	t.Run("initialized", func(t *testing.T) {
		mockApp := &MockApp{}
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{}), nil, func(cfg app.Config) (app.App, error) {
			return mockApp, nil
		}), app.Config{}, nil)
		require.Nil(t, err)
		err = installer.InitializeApp(clientrest.Config{})
		require.Nil(t, err)
		app, err := installer.App()
		assert.Nil(t, err)
		assert.Equal(t, mockApp, app)
	})
}

func TestDefaultInstaller_GroupVersions(t *testing.T) {
	tests := []struct {
		manifest app.ManifestData
		expected []schema.GroupVersion
	}{{
		manifest: app.ManifestData{},
		expected: []schema.GroupVersion{},
	}, {
		manifest: app.ManifestData{
			Group: "test.ext.grafana.com",
			Versions: []app.ManifestVersion{{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{{
					Kind: "Foo",
				}},
			}},
		},
		expected: []schema.GroupVersion{{Group: "test.ext.grafana.com", Version: "v1"}},
	}, {
		manifest: app.ManifestData{
			Group: "test.ext.grafana.com",
			Versions: []app.ManifestVersion{{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{{
					Kind: "Foo",
				}},
			}, {
				Name: "v2alpha1",
				Kinds: []app.ManifestVersionKind{{
					Kind: "Foo",
				}},
			}, {
				Name: "v2alpha2",
				Kinds: []app.ManifestVersionKind{{
					Kind: "Foo",
				}},
			}, {
				Name: "v2beta1",
				Kinds: []app.ManifestVersionKind{{
					Kind: "Foo",
				}},
			}},
		},
		expected: []schema.GroupVersion{
			{Group: "test.ext.grafana.com", Version: "v1"},
			{Group: "test.ext.grafana.com", Version: "v2alpha1"},
			{Group: "test.ext.grafana.com", Version: "v2alpha2"},
			{Group: "test.ext.grafana.com", Version: "v2beta1"},
		},
	}}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(test.manifest), nil, nil), app.Config{}, nil)
			require.Nil(t, err)
			assert.Equal(t, test.expected, installer.GroupVersions())
		})
	}
}

func TestDefaultInstaller_ManifestData(t *testing.T) {
	data := app.ManifestData{
		Group: "test.ext.grafana.com",
		Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{{
				Kind: "Foo",
			}},
		}},
	}
	installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(data), nil, nil), app.Config{}, nil)
	require.Nil(t, err)
	assert.Equal(t, &data, installer.ManifestData())
}

func TestDefaultInstaller_RegisterResourceRouteOperation(t *testing.T) {
	const group = "instrumentation-test.ext.grafana.com"
	const version = "v1"

	newInstaller := func(t *testing.T, callCustomRoute func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error) *defaultInstaller {
		installer, err := NewDefaultAppInstaller(simple.NewAppProvider(app.NewEmbeddedManifest(app.ManifestData{
			Group: group,
		}), nil, nil), app.Config{}, &mockGoTypeResolver{
			CustomRouteReturnGoTypeFunc: func(kind, ver, path, verb string) (any, bool) {
				return &EmptyObject{}, true
			},
		})
		require.NoError(t, err)
		installer.app = &MockApp{CallCustomRouteFunc: callCustomRoute}
		return installer
	}

	newServer := func(t *testing.T, installer *defaultInstaller, rpath string) (*httptest.Server, *restful.WebService) {
		ws := new(restful.WebService)
		ws.Path("/apis/" + group + "/" + version)
		container := restful.NewContainer()
		container.Add(ws)
		err := installer.registerResourceRouteOperation(ws, schema.GroupVersion{Group: group, Version: version}, rpath, &spec3.Operation{}, resource.NamespacedScope, "GET")
		require.NoError(t, err)
		return httptest.NewServer(container), ws
	}

	countAPIServerRequests := func(t *testing.T, rpath string) map[string]float64 {
		t.Helper()
		endpointmetrics.Register()
		families, err := legacyregistry.DefaultGatherer.Gather()
		require.NoError(t, err)
		counts := map[string]float64{}
		for _, family := range families {
			if family.GetName() != "apiserver_request_total" {
				continue
			}
			for _, m := range family.GetMetric() {
				labels := map[string]string{}
				for _, lp := range m.GetLabel() {
					labels[lp.GetName()] = lp.GetValue()
				}
				if labels["group"] == group && labels["version"] == version && labels["resource"] == rpath {
					counts[labels["code"]] += m.GetCounter().GetValue()
				}
			}
		}
		return counts
	}

	t.Run("records apiserver_request_total on success", func(t *testing.T) {
		rpath := "instrument-success"
		installer := newInstaller(t, func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
			w.WriteHeader(http.StatusOK)
			return nil
		})
		srv, _ := newServer(t, installer, rpath)
		defer srv.Close()

		before := countAPIServerRequests(t, rpath)
		resp, err := http.Get(srv.URL + "/apis/" + group + "/" + version + "/namespaces/ns/" + rpath)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		after := countAPIServerRequests(t, rpath)
		assert.Equal(t, before["200"]+1, after["200"], "expected exactly one new apiserver_request_total sample recorded under code=200")
	})

	t.Run("records apiserver_request_total on failure with the status code", func(t *testing.T) {
		rpath := "instrument-failure"
		installer := newInstaller(t, func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
			return apierrors.NewBadRequest("prefix and contains are mutually exclusive")
		})
		srv, _ := newServer(t, installer, rpath)
		defer srv.Close()

		before := countAPIServerRequests(t, rpath)
		resp, err := http.Get(srv.URL + "/apis/" + group + "/" + version + "/namespaces/ns/" + rpath)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)

		after := countAPIServerRequests(t, rpath)
		assert.Equal(t, before["400"]+1, after["400"], "expected exactly one new apiserver_request_total sample recorded under code=400")
		assert.Zero(t, after["200"]-before["200"], "a failed request must not be recorded as code=200")
	})

	t.Run("preserves APIStatus code and reason on error", func(t *testing.T) {
		rpath := "instrument-bad-request"
		installer := newInstaller(t, func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
			return apierrors.NewBadRequest("bad request")
		})
		srv, _ := newServer(t, installer, rpath)
		defer srv.Close()

		resp, err := http.Get(srv.URL + "/apis/" + group + "/" + version + "/namespaces/ns/" + rpath)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))

		var status metav1.Status
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&status))
		assert.Equal(t, metav1.StatusReasonBadRequest, status.Reason)
		assert.Equal(t, "bad request", status.Message)
	})

	t.Run("falls back to 500 for non-status errors", func(t *testing.T) {
		rpath := "instrument-plain-error"
		installer := newInstaller(t, func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
			return errors.New("boom")
		})
		srv, _ := newServer(t, installer, rpath)
		defer srv.Close()

		before := countAPIServerRequests(t, rpath)
		resp, err := http.Get(srv.URL + "/apis/" + group + "/" + version + "/namespaces/ns/" + rpath)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
		assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))

		var status metav1.Status
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&status))
		assert.Equal(t, "boom", status.Message)

		after := countAPIServerRequests(t, rpath)
		assert.Equal(t, before["500"]+1, after["500"], "expected exactly one new apiserver_request_total sample recorded under code=500")
	})
}

var _ GenericAPIServer = &MockGenericAPIServer{}

type MockGenericAPIServer struct {
	InstallAPIGroupFunc       func(apiGroupInfo *genericapiserver.APIGroupInfo) error
	RegisteredWebServicesFunc func() []*restful.WebService
}

func (m *MockGenericAPIServer) InstallAPIGroup(apiGroupInfo *genericapiserver.APIGroupInfo) error {
	if m.InstallAPIGroupFunc != nil {
		return m.InstallAPIGroupFunc(apiGroupInfo)
	}
	return nil
}

func (m *MockGenericAPIServer) RegisteredWebServices() []*restful.WebService {
	if m.RegisteredWebServicesFunc != nil {
		return m.RegisteredWebServicesFunc()
	}
	return nil
}

type mockGoTypeResolver struct {
	KindToGoTypeFunc                 func(kind, version string) (goType resource.Kind, exists bool)
	CustomRouteReturnGoTypeFunc      func(kind, version, path, verb string) (goType any, exists bool)
	CustomRouteQueryGoTypeFunc       func(kind, version, path, verb string) (goType runtime.Object, exists bool)
	CustomRouteRequestBodyGoTypeFunc func(kind, version, path, verb string) (goType any, exists bool)
}

func (m *mockGoTypeResolver) KindToGoType(kind, version string) (goType resource.Kind, exists bool) {
	if m.KindToGoTypeFunc != nil {
		return m.KindToGoTypeFunc(kind, version)
	}
	return resource.Kind{}, false
}
func (m *mockGoTypeResolver) CustomRouteReturnGoType(kind, version, path, verb string) (goType any, exists bool) {
	if m.CustomRouteReturnGoTypeFunc != nil {
		return m.CustomRouteReturnGoTypeFunc(kind, version, path, verb)
	}
	return nil, false
}
func (m *mockGoTypeResolver) CustomRouteQueryGoType(kind, version, path, verb string) (goType runtime.Object, exists bool) {
	if m.CustomRouteQueryGoTypeFunc != nil {
		return m.CustomRouteQueryGoTypeFunc(kind, version, path, verb)
	}
	return nil, false
}
func (m *mockGoTypeResolver) CustomRouteRequestBodyGoType(kind, version, path, verb string) (goType any, exists bool) {
	if m.CustomRouteRequestBodyGoTypeFunc != nil {
		return m.CustomRouteRequestBodyGoTypeFunc(kind, version, path, verb)
	}
	return nil, false
}
