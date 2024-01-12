package query

import (
	"context"
	"fmt"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type registry struct {
	plugins *v0alpha1.DataSourcePluginList
	//lookup    map[string]*v0alpha1.DataSourcePlugin // pluginID >> API
	pluginsMu sync.RWMutex

	// Namespace lookup
	namespaces   map[string]*dsCache
	namespacesMu sync.RWMutex
}

func (r *registry) GetPlugins(ctx context.Context, options *internalversion.ListOptions) (*v0alpha1.DataSourcePluginList, error) {
	r.pluginsMu.RLock()
	defer r.pluginsMu.RUnlock()
	return r.plugins, nil
}

// Thread safe datasource cache
func (r *registry) GetDataSources(ctx context.Context, options *internalversion.ListOptions) (*v0alpha1.DataSourceList, error) {
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		return nil, fmt.Errorf("missing namespace")
	}

	r.namespacesMu.RLock()
	cache, ok := r.namespaces[ns]
	r.namespacesMu.RUnlock()
	if !ok || cache == nil {
		return nil, fmt.Errorf("could not find namespace")
	}

	cache.mu.RLock()
	defer cache.mu.RUnlock()
	return cache.cache, nil
}

type dsCache struct {
	cache *v0alpha1.DataSourceList
	mu    sync.RWMutex
}

// TODO: this should use discovery client and set up watch functions...
func initRegistry() (*registry, error) {
	reg := &registry{
		plugins: &v0alpha1.DataSourcePluginList{
			ListMeta: metav1.ListMeta{
				ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
			},
			Items: []v0alpha1.DataSourcePlugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:              "grafana-testdata-datasource",
						CreationTimestamp: metav1.Now(),
					},
					Title:        "Test Data",
					GroupVersion: "testdata.datasource.grafana.app",
					Capabilities: []string{"..."},
					IconURL:      "https://grafana.com/api/plugins/grafana-testdata-datasource/versions/10.3.0-pre-6b4337a/logos/large",
				},
			},
		},

		namespaces: map[string]*dsCache{
			"default": {
				cache: &v0alpha1.DataSourceList{
					ListMeta: metav1.ListMeta{
						ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
					},
					Items: []v0alpha1.DataSource{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name:              "PD8C576611E62080A",
								CreationTimestamp: metav1.Now(),
							},
							Title:    "gdev-testdata",
							PluginID: "grafana-testdata-datasource",
							Health: &v0alpha1.HealthCheck{
								Status:  "OK",
								Checked: time.Now().UnixMilli(),
							},
						},
					},
				},
			}},
	}

	return reg, nil
}
