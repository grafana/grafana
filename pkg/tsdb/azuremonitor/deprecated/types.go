package deprecated

import (
	"encoding/json"
	"fmt"
	"strings"
)

// insightsJSONQuery is the frontend JSON query model for an Azure Application Insights query.
type insightsJSONQuery struct {
	AppInsights struct {
		Aggregation         string             `json:"aggregation"`
		Alias               string             `json:"alias"`
		AllowedTimeGrainsMs []int64            `json:"allowedTimeGrainsMs"`
		Dimensions          InsightsDimensions `json:"dimension"`
		DimensionFilter     string             `json:"dimensionFilter"`
		MetricName          string             `json:"metricName"`
		TimeGrain           string             `json:"timeGrain"`
	} `json:"appInsights"`
	Raw *bool `json:"raw"`
}

// InsightsDimensions will unmarshal from a JSON string, or an array of strings,
// into a string array. This exists to support an older query format which is updated
// when a user saves the query or it is sent from the front end, but may not be when
// alerting fetches the model.
type InsightsDimensions []string

// UnmarshalJSON fulfills the json.Unmarshaler interface type.
func (s *InsightsDimensions) UnmarshalJSON(data []byte) error {
	*s = InsightsDimensions{}
	if string(data) == "null" || string(data) == "" {
		return nil
	}
	if strings.ToLower(string(data)) == `"none"` {
		return nil
	}
	if data[0] == '[' {
		var sa []string
		err := json.Unmarshal(data, &sa)
		if err != nil {
			return err
		}
		dimensions := []string{}
		for _, v := range sa {
			if v == "none" || v == "None" {
				continue
			}
			dimensions = append(dimensions, v)
		}
		*s = InsightsDimensions(dimensions)
		return nil
	}

	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return fmt.Errorf("could not parse %q as string or array: %w", string(data), err)
	}
	if str != "" {
		*s = InsightsDimensions{str}
		return nil
	}
	return nil
}

type insightsAnalyticsJSONQuery struct {
	InsightsAnalytics struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
	} `json:"insightsAnalytics"`
}
