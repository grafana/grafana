package phlare

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
)

type PyroscopeClient struct {
	httpClient *http.Client
	URL        string
}

type App struct {
	Name string `json:"name"`
}

func NewPyroscopeClient(httpClient *http.Client, url string) *PyroscopeClient {
	return &PyroscopeClient{
		httpClient: httpClient,
		URL:        url,
	}
}

func (c *PyroscopeClient) ProfileTypes(ctx context.Context) ([]ProfileType, error) {
	resp, err := c.httpClient.Get(c.URL + "/api/apps")
	if err != nil {
		return nil, err
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var apps []App

	err = json.Unmarshal(body, &apps)
	if err != nil {
		return nil, err
	}

	var profileTypes []ProfileType
	for _, app := range apps {
		profileTypes = append(profileTypes, ProfileType{
			ID:    app.Name,
			Label: app.Name,
		})
	}

	return profileTypes, nil
}

type PyroscopeProfileResponse struct {
	Flamebearer *Flamebearer `json:"flamebearer"`
}

type Flamebearer struct {
	Levels   []*Level `json:"levels"`
	MaxSelf  int64    `json:"maxSelf"`
	NumTicks int64    `json:"numTicks"`
	Names    []string `json:"names"`
}

func (c *PyroscopeClient) GetProfile(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64) (*FlameGraph, error) {
	params := url.Values{}
	params.Add("from", strconv.FormatInt(start, 10))
	params.Add("until", strconv.FormatInt(end, 10))
	params.Add("query", profileTypeID+labelSelector)
	params.Add("format", "json")
	resp, err := c.httpClient.Get(c.URL + "/api/flamegraph?" + params.Encode())

	if err != nil {
		return nil, err
	}

	var respData *PyroscopeProfileResponse

	err = json.NewDecoder(resp.Body).Decode(&respData)
	if err != nil {
		return nil, err
	}

	return &FlameGraph{
		Names:   respData.Flamebearer.Names,
		Levels:  respData.Flamebearer.Levels,
		Total:   respData.Flamebearer.NumTicks,
		MaxSelf: respData.Flamebearer.MaxSelf,
	}, nil
}

func (c *PyroscopeClient) GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, step float64) ([]*Series, error) {
	// TODO implement
	return []*Series{}, nil
}

func (c *PyroscopeClient) LabelNames(ctx context.Context, query string, start int64, end int64) ([]string, error) {
	params := url.Values{}
	// Seems like this should be seconds instead of millis for other endpoints
	params.Add("from", strconv.FormatInt(start/1000, 10))
	params.Add("until", strconv.FormatInt(end/1000, 10))
	params.Add("query", query)
	resp, err := c.httpClient.Get(c.URL + "/labels?" + params.Encode())
	if err != nil {
		return nil, err
	}

	var names []string
	err = json.NewDecoder(resp.Body).Decode(&names)
	if err != nil {
		return nil, err
	}

	return names, nil
}

func (c *PyroscopeClient) LabelValues(ctx context.Context, query string, label string, start int64, end int64) ([]string, error) {
	params := url.Values{}
	// Seems like this should be seconds instead of millis for other endpoints
	params.Add("from", strconv.FormatInt(start/1000, 10))
	params.Add("until", strconv.FormatInt(end/1000, 10))
	params.Add("label", label)
	params.Add("query", query)
	resp, err := c.httpClient.Get(c.URL + "/labels?" + params.Encode())
	if err != nil {
		return nil, err
	}
	var values []string
	err = json.NewDecoder(resp.Body).Decode(&values)
	if err != nil {
		return nil, err
	}

	return values, nil
}

func (c *PyroscopeClient) AllLabelsAndValues(ctx context.Context, matchers []string) (map[string][]string, error) {
	// we return empty message because compared to phlare getting all the labels here would be expensive. Front end
	// needs to deal with this.
	return map[string][]string{}, nil
}
