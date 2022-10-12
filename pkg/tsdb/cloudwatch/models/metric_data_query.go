package models

type MetricsDataQuery struct {
	Datasource        map[string]string      `json:"datasource,omitempty"`
	Dimensions        map[string]interface{} `json:"dimensions,omitempty"`
	Expression        string                 `json:"expression,omitempty"`
	Id                string                 `json:"id,omitempty"`
	Label             *string                `json:"label,omitempty"`
	MatchExact        *bool                  `json:"matchExact,omitempty"`
	MaxDataPoints     int                    `json:"maxDataPoints,omitempty"`
	MetricEditorMode  *int                   `json:"metricEditorMode,omitempty"`
	MetricName        string                 `json:"metricName,omitempty"`
	MetricQueryType   MetricQueryType        `json:"metricQueryType,omitempty"`
	Namespace         string                 `json:"namespace,omitempty"`
	Period            string                 `json:"period,omitempty"`
	RefId             string                 `json:"refId,omitempty"`
	Region            string                 `json:"region,omitempty"`
	SqlExpression     string                 `json:"sqlExpression,omitempty"`
	Statistic         *string                `json:"statistic,omitempty"`
	Statistics        []*string              `json:"statistics,omitempty"`
	TimezoneUTCOffset string                 `json:"timezoneUTCOffset,omitempty"`
	QueryType         string                 `json:"type,omitempty"`
	Hide              *bool                  `json:"hide,omitempty"`
	Alias             string                 `json:"alias,omitempty"`
}
