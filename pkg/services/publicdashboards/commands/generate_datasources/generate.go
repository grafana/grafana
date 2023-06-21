package generate_datasources

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"

	"github.com/grafana/grafana/pkg/expr"
)

var grafanaDatasources = []string{expr.DatasourceType, "datasource"}

type listPluginResponse struct {
	Items []struct {
		Slug string `json:"slug"`
	} `json:"items"`
}

type datasourceDetails struct {
	Slug     string `json:"slug"`
	Backend  bool   `json:"backend"`
	Alerting bool   `json:"alerting"`
}

type datasource struct {
	Json datasourceDetails `json:"json"`
}

// Get the slugs of all datasource plugins that are compatible with public dashboards
func GetCompatibleDatasources(baseUrl string) ([]string, error) {
	slugs, err := getDatasourcePluginSlugs(baseUrl)
	if err != nil {
		return nil, err
	}

	datasources := getDatasourceDetails(slugs, baseUrl)

	// we only consider a datasource to be supported when alerting and backend are both true
	var supported []string
	for _, datasource := range datasources {
		if datasource.Alerting && datasource.Backend {
			supported = append(supported, datasource.Slug)
		}
	}

	supported = append(supported, grafanaDatasources...)

	sort.Strings(supported)
	return supported, nil
}

// Get a list of all the datasource plugin slugs
func getDatasourcePluginSlugs(baseUrl string) ([]string, error) {
	resp, err := http.Get(baseUrl + allPluginsEndpoint())
	if err != nil {
		return nil, err
	}
	res := &listPluginResponse{}
	err = json.NewDecoder(resp.Body).Decode(res)
	if err != nil {
		return nil, err
	}
	slugs := make([]string, 0, len(res.Items))
	for _, meta := range res.Items {
		slugs = append(slugs, meta.Slug)
	}
	_ = resp.Body.Close()
	return slugs, nil
}

// Get the details for each datasource plugin by its slug
func getDatasourceDetails(slugs []string, baseUrl string) []datasourceDetails {
	datasources := make([]datasourceDetails, len(slugs))
	var wg sync.WaitGroup
	for i, slug := range slugs {
		wg.Add(1)
		// create new goroutine for each outgoing request
		go func(i int, slug string) {
			defer wg.Done()
			url := baseUrl + pluginEndpoint(slug)
			// url can not be constant since it gets generated based on slug
			//nolint:gosec
			r, err := http.Get(url)
			if err != nil {
				panic(err)
			}

			datasource := &datasource{}
			err = json.NewDecoder(r.Body).Decode(datasource)
			if err != nil {
				panic(err)
			}
			datasource.Json.Slug = slug
			datasources[i] = datasource.Json
			_ = r.Body.Close()
		}(i, slug)
	}

	wg.Wait()

	return datasources
}

func pluginEndpoint(slug string) string {
	return fmt.Sprintf("/api/plugins/%s?version=latest", slug)
}

func allPluginsEndpoint() string {
	return "/api/plugins?orderBy=weight&direction=asc&typeCodeIn[]=datasource"
}
