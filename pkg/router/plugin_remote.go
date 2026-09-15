package router

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/plugins/definition"
)

// This is for cloud only (hackathon prep!)
type remotePluginLoader struct {
	url string
}

func (pl remotePluginLoader) Load(context.Context) ([]Backend, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(pl.url)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	deployment := &definition.PluginDeployments{}
	if err = json.NewDecoder(resp.Body).Decode(deployment); err != nil {
		return nil, err
	}

	plugins := make([]Backend, 0, len(deployment.Plugins))
	for _, d := range deployment.Plugins {
		if d.Definition.Manifest == nil {
			continue // skip?
		}
		g := metav1.APIGroup{
			Name:     d.Definition.Manifest.Group,
			Versions: make([]metav1.GroupVersionForDiscovery, len(d.Definition.Manifest.Versions)),
		}
		for i, v := range d.Definition.Manifest.Versions {
			g.Versions[i] = metav1.GroupVersionForDiscovery{
				GroupVersion: fmt.Sprintf("%s/%s", g.Name, v.Name),
				Version:      v.Name,
			}
			if v.Name == d.Definition.Manifest.PreferredVersion {
				g.PreferredVersion = g.Versions[i]
			}
		}
		plugins = append(plugins, &dummyRemotePlugin{
			group:      g,
			deployment: d,
		})
	}
	return plugins, nil
}

func (remotePluginLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

type dummyRemotePlugin struct {
	group      metav1.APIGroup
	deployment definition.PluginDeployment
}

func (d *dummyRemotePlugin) Group() metav1.APIGroup {
	return d.group
}

func (d *dummyRemotePlugin) Load(context.Context) (http.Handler, error) {
	return d, nil
}

func (d *dummyRemotePlugin) Key() string {
	return "static"
}

// TODO... obviously not this
func (d *dummyRemotePlugin) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Add("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(d.deployment)
}
