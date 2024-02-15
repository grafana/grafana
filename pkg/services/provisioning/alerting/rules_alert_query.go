package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// {
//     "expr": "",
//     "for": "5m",
//     "grafana_alert": {
//         "id": 24,
//         "orgId": 1,
//         "title": "rule-name-123",
//         "condition": "C",
//			|
//			| This is generated here
//          V
//         "data": [
//             {
//                 "refId": "A",
//                 "queryType": "",
//                 "relativeTimeRange": {
//                     "from": 600,
//                     "to": 0
//                 },
//                 "datasourceUid": "grafanacloud-prom",
//                 "model": {
//                     "editorMode": "code",
//                     "expr": "1",
//                     "hide": false,
//                     "intervalMs": 1000,
//                     "legendFormat": "__auto",
//                     "maxDataPoints": 43200,
//                     "range": true,
//                     "refId": "A"
//                 }
//             },
//             {
//                 "refId": "B",
//                 "queryType": "",
//                 "relativeTimeRange": {
//                     "from": 600,
//                     "to": 0
//                 },
//                 "datasourceUid": "__expr__",
//                 "model": {
//                     "conditions": [
//                         {
//                             "evaluator": {
//                                 "params": [],
//                                 "type": "gt"
//                             },
//                             "operator": {
//                                 "type": "and"
//                             },
//                             "query": {
//                                 "params": [
//                                     "B"
//                                 ]
//                             },
//                             "reducer": {
//                                 "params": [],
//                                 "type": "last"
//                             },
//                             "type": "query"
//                         }
//                     ],
//                     "datasource": {
//                         "type": "__expr__",
//                         "uid": "__expr__"
//                     },
//                     "expression": "A",
//                     "hide": false,
//                     "intervalMs": 1000,
//                     "maxDataPoints": 43200,
//                     "reducer": "last",
//                     "refId": "B",
//                     "settings": {
//                         "mode": "dropNN"
//                     },
//                     "type": "reduce"
//                 }
//             },
//             {
//                 "refId": "C",
//                 "queryType": "",
//                 "relativeTimeRange": {
//                     "from": 600,
//                     "to": 0
//                 },
//                 "datasourceUid": "__expr__",
//                 "model": {
//                     "conditions": [
//                         {
//                             "evaluator": {
//                                 "params": [
//                                     2
//                                 ],
//                                 "type": "gt"
//                             },
//                             "operator": {
//                                 "type": "and"
//                             },
//                             "query": {
//                                 "params": [
//                                     "C"
//                                 ]
//                             },
//                             "reducer": {
//                                 "params": [],
//                                 "type": "last"
//                             },
//                             "type": "query"
//                         }
//                     ],
//                     "datasource": {
//                         "type": "__expr__",
//                         "uid": "__expr__"
//                     },
//                     "expression": "B",
//                     "hide": false,
//                     "intervalMs": 1000,
//                     "maxDataPoints": 43200,
//                     "refId": "C",
//                     "type": "threshold"
//                 }
//             }
//         ],
//         "updated": "2023-05-18T20:42:11Z",
//         "intervalSeconds": 60,
//         "version": 1,
//         "uid": "fec6adee-cbdd-49f1-9fff-e1cd91a2a856",
//         "namespace_uid": "b6790d73-82b8-475f-b348-a5dd7df3ae17",
//         "namespace_id": 31,
//         "rule_group": "ev-group-123",
//         "no_data_state": "NoData",
//         "exec_err_state": "Error",
//         "is_paused": false
//     }
// }

const (
	aggrFirst         = "first"
	aggrLast          = "last"
	aggrMean          = "mean"
	aggrAvg           = "avg"
	aggrMin           = "min"
	aggrMax           = "max"
	aggrCount         = "count"
	exprDatasourceUID = "__expr__"
	refIDQuery        = "A"
	refIDAggr         = "B"
	refIDCondition    = "C"
)

func isSupportedType(t string) bool {
	switch t {
	case "prometheus":
	case "loki":
		return true
	}
	return false
}

func generateAlertQuery(dsType, dsUID, expr, aggr, cond string) ([]models.AlertQuery, error) {
	res := make([]models.AlertQuery, 3)
	dsQuery, err := generateDsQuery(dsType, dsUID, expr)
	if err != nil {
		return nil, err
	}
	res = append(res, dsQuery)
	aggrQuery, err := generateAggr(aggr)
	if err != nil {
		return nil, err
	}
	res = append(res, aggrQuery)
	condQuery, err := generateCondition(cond)
	if err != nil {
		return nil, err
	}
	res = append(res, condQuery)
	return res, nil
}

//	{
//	    "refId": "A",
//	    "queryType": "",
//	    "relativeTimeRange": {
//	        "from": 600,
//	        "to": 0
//	    },
//	    "datasourceUid": "grafanacloud-prom",
//	    "model": {
//	        "editorMode": "code",
//	        "expr": "1",
//	        "hide": false,
//	        "intervalMs": 1000,
//	        "legendFormat": "__auto",
//	        "maxDataPoints": 43200,
//	        "range": true,
//	        "refId": "A"
//	    }
//	},

const dsQueryTemplate = `{
  "editorMode": "code",
  "expr": "%s",
  "hide": false,
  "intervalMs": 1000,
  "legendFormat": "__auto",
  "maxDataPoints": 43200,
  "range": true,
  "refId": "%s"
}
`

func generateDsQuery(dsType, dsUID, expr string) (models.AlertQuery, error) {
	return models.AlertQuery{
		RefID: refIDQuery,
		RelativeTimeRange: models.RelativeTimeRange{
			From: 600,
			To:   0,
		},
		DatasourceUID: dsUID,
		Model:         []byte(fmt.Sprintf(dsQueryTemplate, expr, refIDQuery)),
	}, nil
}

//	{
//	    "refId": "B",
//	    "queryType": "",
//	    "relativeTimeRange": {
//	        "from": 600,
//	        "to": 0
//	    },
//	    "datasourceUid": "__expr__",
//	    "model": {
//	        "conditions": [
//	            {
//	                "evaluator": {
//	                    "params": [],
//	                    "type": "gt"
//	                },
//	                "operator": {
//	                    "type": "and"
//	                },
//	                "query": {
//	                    "params": [
//	                        "B"
//	                    ]
//	                },
//	                "reducer": {
//	                    "params": [],
//	                    "type": "last"
//	                },
//	                "type": "query"
//	            }
//	        ],
//	        "datasource": {
//	            "type": "__expr__",
//	            "uid": "__expr__"
//	        },
//	        "expression": "A",
//	        "hide": false,
//	        "intervalMs": 1000,
//	        "maxDataPoints": 43200,
//	        "reducer": "last",
//	        "refId": "B",
//	        "settings": {
//	            "mode": "dropNN"
//	        },
//	        "type": "reduce"
//	    }
//	},

// TODO(JP): remove useless part of template, some research needed.
const aggrTemplate = `{
	"conditions": [
		{
			"evaluator": {
				"params": [],
				"type": "gt"
			},
			"operator": {
				"type": "and"
			},
			"query": {
				"params": [
					"{{.refIDAggr}}"
				]
			},
			"reducer": {
				"params": [],
				"type": "{{.aggr}}"
			},
			"type": "query"
		}
	],
	"datasource": {
		"type": "__expr__",
		"uid": "__expr__"
	},
	"expression": "{{.refIDQuery}}",
	"hide": false,
	"intervalMs": 1000,
	"maxDataPoints": 43200,
	"reducer": "{{.aggr}}",
	"refId": "{{.refIDAggr}}",
	"settings": {
		"mode": "{{.mode}}"
	},
	"type": "reduce"
}
`

func generateAggr(aggr string) (models.AlertQuery, error) {
	// TODO(JP): only do this once
	temp, err := template.New("aggr").Parse(aggrTemplate)
	if err != nil {
		return models.AlertQuery{}, err
	}
	// If no aggration is set, we use last by default.
	if strings.TrimSpace(aggr) == "" {
		aggr = aggrLast
	}
	switch aggr {
	case aggrFirst, aggrLast, aggrMean, aggrAvg, aggrMin, aggrMax, aggrCount:
		// valid
		break
	default:
		return models.AlertQuery{}, fmt.Errorf("aggregation '%s' is not supported", aggr)
	}
	var buf bytes.Buffer
	temp.Execute(&buf, map[string]string{
		"refIDAggr":  refIDAggr,
		"refIDQuery": refIDQuery,
		"aggr":       aggr,
		// TODO(JP): maybe make this configurable
		"mode": "dropNN",
	})
	return models.AlertQuery{
		RefID: refIDAggr,
		RelativeTimeRange: models.RelativeTimeRange{
			From: 600,
			To:   0,
		},
		DatasourceUID: exprDatasourceUID,
		Model:         json.RawMessage(buf.Bytes()),
	}, nil
}

//	{
//	    "refId": "C",
//	    "queryType": "",
//	    "relativeTimeRange": {
//	        "from": 600,
//	        "to": 0
//	    },
//	    "datasourceUid": "__expr__",
//	    "model": {
//	        "conditions": [
//	            {
//	                "evaluator": {
//	                    "params": [
//	                        2
//	                    ],
//	                    "type": "gt"
//	                },
//	                "operator": {
//	                    "type": "and"
//	                },
//	                "query": {
//	                    "params": [
//	                        "C"
//	                    ]
//	                },
//	                "reducer": {
//	                    "params": [],
//	                    "type": "last"
//	                },
//	                "type": "query"
//	            }
//	        ],
//	        "datasource": {
//	            "type": "__expr__",
//	            "uid": "__expr__"
//	        },
//	        "expression": "B",
//	        "hide": false,
//	        "intervalMs": 1000,
//	        "maxDataPoints": 43200,
//	        "refId": "C",
//	        "type": "threshold"
//	    }
//	}

// TODO(JP): remove useless part of template, some research needed.
const condTemplate = `{
	"conditions": [
		{
			"evaluator": {
				"params": [{{.nums}}],
				"type": "{{.op}}"
			},
			"operator": {
				"type": "and"
			},
			"query": {
				"params": [
					"C"
				]
			},
			"reducer": {
				"params": [],
				"type": "last"
			},
			"type": "query"
		}
	],
	"datasource": {
		"type": "__expr__",
		"uid": "__expr__"
	},
	"expression": "{{.refIDAggr}}",
	"hide": false,
	"intervalMs": 1000,
	"maxDataPoints": 43200,
	"refId": "{{.refIDCondition}}",
	"type": "threshold"
}
`

// examples > 0, lt 5, wr 0 5, or 5 10
// TODO(JP): perhaps support == and !=
func generateCondition(cond string) (models.AlertQuery, error) {
	// Set default condition if not provided.
	if cond == "" {
		cond = "gt 0"
	}

	tokens := strings.Split(cond, " ")
	err := validateTokens(tokens)
	if err != nil {
		return models.AlertQuery{}, err
	}

	data, err := buildDataFromTokens(tokens)
	if err != nil {
		return models.AlertQuery{}, err
	}

	temp, err := template.New("cond").Parse(condTemplate)
	if err != nil {
		return models.AlertQuery{}, fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	err = temp.Execute(&buf, data)
	if err != nil {
		return models.AlertQuery{}, fmt.Errorf("failed to execute template: %w", err)
	}

	return models.AlertQuery{
		RefID: refIDCondition,
		RelativeTimeRange: models.RelativeTimeRange{
			From: 600,
			To:   0,
		},
		DatasourceUID: exprDatasourceUID,
		Model:         json.RawMessage(buf.Bytes()),
	}, nil
}

func validateTokens(tokens []string) error {
	if len(tokens) < 2 {
		return fmt.Errorf("condition is not valid, should be in format '<op> <threshold> [<threshold>]', i.e 'gt 0'")
	}

	for i, token := range tokens[1:] {
		if _, err := strconv.ParseFloat(token, 64); err != nil {
			return fmt.Errorf("threshold '%s' at position %d is not a valid number", token, i+1)
		}
	}

	return nil
}

func buildDataFromTokens(tokens []string) (map[string]string, error) {
	data := map[string]string{
		"refIDAggr":      refIDAggr,
		"refIDCondition": refIDCondition,
	}
	switch tokens[0] {
	case "gt", ">":
		data["op"] = "gt"
		data["nums"] = tokens[1]
	case "lt", "<":
		data["op"] = "lt"
		data["nums"] = tokens[1]
	case "wr":
		if len(tokens) < 3 {
			return nil, fmt.Errorf("condition 'within_range' requires two thresholds")
		}
		data["op"] = "within_range"
		data["nums"] = strings.Join(tokens[1:3], ",")
	case "or":
		if len(tokens) < 3 {
			return nil, fmt.Errorf("condition 'outside_range' requires two thresholds")
		}
		data["op"] = "outside_range"
		data["nums"] = strings.Join(tokens[1:3], ",")
	default:
		return nil, fmt.Errorf("unrecognized condition operator '%s'", tokens[0])
	}

	return data, nil
}
