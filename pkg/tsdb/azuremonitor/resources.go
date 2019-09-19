package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/net/context/ctxhttp"
)

type resources struct {
	httpClient *http.Client
	dsInfo     *models.DataSource
	ctx        context.Context
}

func (r *resources) Get(azureMonitorData *AzureMonitorData, subscriptions []interface{}, createRequest func(context.Context, *models.DataSource) (*http.Request, error)) ([]resource, error) {
	resourcesMap := map[string]resource{}

	for _, subscriptionID := range subscriptions {
		resourcesResponse, err := r.executeQuery(r.ctx, fmt.Sprintf("%v", subscriptionID), createRequest)
		if err != nil {
			return []resource{}, err
		}

		for _, resourceResponse := range resourcesResponse.Value {
			resource := resource{
				ID:             resourceResponse.ID,
				Name:           resourceResponse.Name,
				Type:           resourceResponse.Type,
				Location:       resourceResponse.Location,
				SubscriptionID: fmt.Sprintf("%v", subscriptionID),
			}

			match := contains(azureMonitorData.ResourceGroups, resource.ParseGroup()) &&
				contains(azureMonitorData.Locations, resource.Location) &&
				azureMonitorData.MetricDefinition == resource.Type

			if _, ok := resourcesMap[resource.GetKey()]; !ok && match {
				resourcesMap[resource.GetKey()] = resource
			}
		}
	}

	resources := []resource{}
	for _, resource := range resourcesMap {
		resources = append(resources, resource)
	}

	return resources, nil
}

func (r *resources) executeQuery(ctx context.Context, subscriptionID string, createRequest func(context.Context, *models.DataSource) (*http.Request, error)) (ResourcesResponse, error) {
	req, err := createRequest(r.ctx, r.dsInfo)
	if err != nil {
		return ResourcesResponse{}, err
	}

	params := url.Values{}
	params.Add("api-version", "2018-01-01")
	req.URL.Path = path.Join(req.URL.Path, subscriptionID, "resources")
	req.URL.RawQuery = params.Encode()

	res, err := ctxhttp.Do(ctx, r.httpClient, req)
	if err != nil {
		return ResourcesResponse{}, err
	}
	data, err := r.unmarshalResponse(res)
	if err != nil {
		return ResourcesResponse{}, err
	}

	return data, nil
}

func (r *resources) unmarshalResponse(res *http.Response) (ResourcesResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return ResourcesResponse{}, err
	}

	if res.StatusCode/100 != 2 {
		azlog.Error("Request failed", "status", res.Status, "body", string(body))
		return ResourcesResponse{}, fmt.Errorf(string(body))
	}

	var data ResourcesResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		azlog.Error("Failed to unmarshal AzureMonitor Resource response", "error", err, "status", res.Status, "body", string(body))
		return ResourcesResponse{}, err
	}

	return data, nil
}
