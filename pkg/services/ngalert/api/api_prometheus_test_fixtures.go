package api

// prometheusQueryModel represents the way we express a prometheus query as part of an alert query.
// It supports formatting for the refID of the query.
const prometheusQueryModel = `
{
	"exemplar": false,
	"expr": "vector(1)",
	"hide": false,
	"interval": "",
	"intervalMs": 1000,
	"legendFormat": "",
	"maxDataPoints": 43200,
	"refId": "%s"
}
`

// classicConditionsModel represents the way we express a classic condition as part of an alert query.
// It supports formatting for 1) the refID of the query and 2) the refID of the condition.
const classicConditionsModel = `
{
	"conditions": [{
		"evaluator": {
			"params": [0.5],
			"type": "gt"
		},
		"operator": {
			"type": "and"
		},
		"query": {
			"params": ["%s"]
		},
		"reducer": {
			"params": [],
			"type": "last"
		},
		"type": "query"
	}],
	"datasource": {
		"type": "__expr__",
		"uid": "__expr__"
	},
	"hide": false,
	"intervalMs": 1000,
	"maxDataPoints": 43200,
	"refId": "%s",
	"type": "classic_conditions"
}
`

// reduceLastExpressionModel represents the way we express reduce to last data point as part of an alert query.
// It supports formatting for 1) the refID of the query to target and 2) the refID of the condition.
const reduceLastExpressionModel = `
{
	"conditions": [{
		"evaluator": {
			"params": [0,0],
			"type": "gt"
		},
		"operator": {
			"type": "and"
		},
		"query": {
			"params": []
		},
		"reducer": {
			"params": [],
			"type": "last"
		},
		"type": "query"
	}],
	"datasource": {
		"type": "__expr__",
		"uid": "__expr__"
	},
	"expression": "%s",
	"hide": false,
	"intervalMs": 1000,
	"maxDataPoints": 43200,
	"reducer": "last",
	"refId": "%s",
	"type": "reduce"
}
`

// reduceLastExpressionModel represents the way we express a math (sum of two refIDs greater than 1) operation of an alert query.
// It supports formatting for 1) refID of the first operand, 2) refID of the second operand and 3) the refID of the math operation.
const mathExpressionModel = `
{
	"conditions": [{
		"evaluator": {
			"params": [0, 0],
			"type": "gt"
		},
		"operator": {
			"type": "and"
		},
		"query": {
			"params": []
		},
		"reducer": {
			"params": [],
			"type": "avg"
		},
		"type": "query"
	}],
	"datasource": {
		"type": "__expr__",
		"uid": "__expr__"
	},
	"expression": "$%s + $%s \u003e 1",
	"hide": false,
	"intervalMs": 1000,
	"maxDataPoints": 43200,
	"refId": "%s",
	"type": "math"
}
`
