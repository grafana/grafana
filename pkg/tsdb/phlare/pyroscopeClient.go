package phlare

import (
	"context"
	"encoding/json"
	"fmt"
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
	Flamebearer *PyroFlamebearer `json:"flamebearer"`
	Metadata    *Metadata        `json:"metadata"`
}

type Metadata struct {
	Units string `json:"units"`
}

type PyroFlamebearer struct {
	Levels   [][]int64 `json:"levels"`
	MaxSelf  int64     `json:"maxSelf"`
	NumTicks int64     `json:"numTicks"`
	Names    []string  `json:"names"`
}

func (c *PyroscopeClient) GetProfile(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64) (*ProfileResponse, error) {
	params := url.Values{}
	params.Add("from", strconv.FormatInt(start, 10))
	params.Add("until", strconv.FormatInt(end, 10))
	params.Add("query", profileTypeID+labelSelector)
	params.Add("format", "json")

	url := c.URL + "/render?" + params.Encode()
	logger.Debug("calling /render", "url", url)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error calling /render api: %v", err)
	}

	var respData *PyroscopeProfileResponse

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %v", err)
	}

	err = json.Unmarshal(body, &respData)
	if err != nil {
		logger.Debug("flamegraph data", "body", string(body))
		return nil, fmt.Errorf("error decoding flamegraph data: %v", err)
	}

	mappedLevels := make([]*Level, len(respData.Flamebearer.Levels))
	for i, level := range respData.Flamebearer.Levels {
		mappedLevels[i] = &Level{
			Values: level,
		}
	}

	units := "short"
	if respData.Metadata.Units == "bytes" {
		units = "bytes"
	}
	if respData.Metadata.Units == "samples" {
		units = "ms"
	}

	return &ProfileResponse{
		Flamebearer: &Flamebearer{
			Names:   respData.Flamebearer.Names,
			Levels:  mappedLevels,
			Total:   respData.Flamebearer.NumTicks,
			MaxSelf: respData.Flamebearer.MaxSelf,
		},
		Units: units,
	}, nil
}

func (c *PyroscopeClient) GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, step float64) (*SeriesResponse, error) {
	// TODO implement
	return &SeriesResponse{
		Series: []*Series{},
	}, nil
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

	var filtered []string
	for _, label := range names {
		// Using the same func from Phlare client, works but should do separate one probably
		if !isPrivateLabel(label) {
			filtered = append(filtered, label)
		}
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
