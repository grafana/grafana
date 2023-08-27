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

func (c *PyroscopeClient) ProfileTypes(ctx context.Context) ([]*ProfileType, error) {
	resp, err := c.httpClient.Get(c.URL + "/api/apps")
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var apps []App

	err = json.Unmarshal(body, &apps)
	if err != nil {
		return nil, err
	}

	var profileTypes []*ProfileType
	for _, app := range apps {
		profileTypes = append(profileTypes, &ProfileType{
			ID:    app.Name,
			Label: app.Name,
		})
	}

	return profileTypes, nil
}

type PyroscopeProfileResponse struct {
	Flamebearer *PyroFlamebearer  `json:"flamebearer"`
	Metadata    *Metadata         `json:"metadata"`
	Groups      map[string]*Group `json:"groups"`
}

type Metadata struct {
	Units string `json:"units"`
}

type Group struct {
	StartTime     int64   `json:"startTime"`
	Samples       []int64 `json:"samples"`
	DurationDelta int64   `json:"durationDelta"`
}

type PyroFlamebearer struct {
	Levels   [][]int64 `json:"levels"`
	MaxSelf  int64     `json:"maxSelf"`
	NumTicks int64     `json:"numTicks"`
	Names    []string  `json:"names"`
}

func (c *PyroscopeClient) getProfileData(ctx context.Context, profileTypeID, labelSelector string, start, end int64, maxNodes *int64, groupBy []string) (*PyroscopeProfileResponse, error) {
	params := url.Values{}
	params.Add("from", strconv.FormatInt(start, 10))
	params.Add("until", strconv.FormatInt(end, 10))
	params.Add("query", profileTypeID+labelSelector)
	if maxNodes != nil {
		params.Add("maxNodes", strconv.FormatInt(*maxNodes, 10))
	}
	params.Add("format", "json")
	if len(groupBy) > 0 {
		params.Add("groupBy", groupBy[0])
	}

	url := c.URL + "/render?" + params.Encode()
	logger.Debug("calling /render", "url", url)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("error calling /render api: %v", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("failed to close response body", "err", err)
		}
	}()

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

	return respData, nil
}

func (c *PyroscopeClient) GetProfile(ctx context.Context, profileTypeID, labelSelector string, start, end int64, maxNodes *int64) (*ProfileResponse, error) {
	respData, err := c.getProfileData(ctx, profileTypeID, labelSelector, start, end, maxNodes, nil)
	if err != nil {
		return nil, err
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

func (c *PyroscopeClient) GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start, end int64, groupBy []string, step float64) (*SeriesResponse, error) {
	// This is super ineffective at the moment. We need 2 different APIs one for profile one for series (timeline) data
	// but Pyro returns all in single response. This currently does the simplest thing and calls the same API 2 times
	// and gets the part of the response it needs.
	respData, err := c.getProfileData(ctx, profileTypeID, labelSelector, start, end, nil, groupBy)
	if err != nil {
		return nil, err
	}

	stepMillis := int64(step * 1000)
	var series []*Series

	if len(respData.Groups) == 1 {
		series = []*Series{processGroup(respData.Groups["*"], stepMillis, nil)}
	} else {
		for key, val := range respData.Groups {
			// If we have a group by, we don't want the * group
			if key != "*" {
				label := &LabelPair{
					Name:  groupBy[0],
					Value: key,
				}

				series = append(series, processGroup(val, stepMillis, label))
			}
		}
	}

	return &SeriesResponse{Series: series}, nil
}

// processGroup turns group timeline data into the Series format. Pyro does not seem to have a way to define step, so we
// always get the data in specific step, and we have to aggregate a bit into s step size we need.
func processGroup(group *Group, step int64, label *LabelPair) *Series {
	series := &Series{}
	if label != nil {
		series.Labels = []*LabelPair{label}
	}

	durationDeltaMillis := group.DurationDelta * 1000
	timestamp := group.StartTime * 1000
	value := int64(0)

	for i, sample := range group.Samples {
		pointsLen := int64(len(series.Points))
		// Check if the timestamp of the sample is more than next timestamp in the series. If so we create a new point
		// with the value we have so far.
		if int64(i)*durationDeltaMillis > step*pointsLen+1 {
			series.Points = append(series.Points, &Point{
				Value:     float64(value),
				Timestamp: timestamp + step*pointsLen,
			})
			value = 0
		}

		value += sample
	}

	return series
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
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("failed to close response body", "err", err)
		}
	}()

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

	return filtered, nil
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
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("failed to close response body", "err", err)
		}
	}()
	var values []string
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(body, &values)
	if err != nil {
		logger.Debug("response", "body", string(body))
		return nil, fmt.Errorf("error unmarshaling response %v", err)
	}

	return values, nil
}
