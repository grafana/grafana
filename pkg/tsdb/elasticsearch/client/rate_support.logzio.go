// LOGZ.IO GRAFANA CHANGE :: DEV-19067 - LOGZ file - add LogzioExtraParams to support 'rate' function
package es

import "encoding/json"

type LogzioExtraParams struct {
	Rate *Rate
}

type Rate struct {
	AggNames []string
}

func (q *LogzioExtraParams) MarshalJSON() ([]byte, error) {
	root := make(map[string]interface{})
	if q.Rate != nil {
		root["rate"] = q.Rate
	}

	return json.Marshal(root)
}

func (q *Rate) MarshalJSON() ([]byte, error) {
	root := make(map[string]interface{})
	if len(q.AggNames) > 0 {
		root["aggNames"] = q.AggNames
	} else {
		root["aggNames"] = []string{}
	}

	return json.Marshal(root)
}

type LogzioExtraParamsBuilder struct {
	rate *Rate
}

func (b *SearchRequestBuilder) LogzioExtraParams() *LogzioExtraParamsBuilder {
	if b.logzioExtraParamBuilder == nil {
		b.logzioExtraParamBuilder = &LogzioExtraParamsBuilder{
			rate: &Rate{
				AggNames: make([]string, 0),
			},
		}
	}

	return b.logzioExtraParamBuilder
}

func (b *LogzioExtraParamsBuilder) RateAggName(aggName string) *LogzioExtraParamsBuilder {
	b.rate.AggNames = append(b.rate.AggNames, aggName)
	return b
}

func (b *LogzioExtraParamsBuilder) Build() (LogzioExtraParams, error) {
	logzioExtraParams := LogzioExtraParams{
		Rate: b.rate,
	}

	return logzioExtraParams, nil
}
