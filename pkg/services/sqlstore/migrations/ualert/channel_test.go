package ualert

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

func TestChannelInfoExtractionFromDashboard(t *testing.T) {
	data, err := simplejson.NewJson([]byte(exampleDashboardWithAlert))
	require.NoError(t, err)

	d := oldDash{
		Data: data,
	}
	channelUids, ruleName, ruleMessage, err := extractChannelInfoFromDashboard(d, 2)
	require.NoError(t, err)

	require.Equal(t, []interface{}{"WbP9r0jMk", "TYHj90CMk", 3, 9}, channelUids)
	require.Equal(t, "Panel Title alert", ruleName)
	require.Equal(t, "This is the message", ruleMessage)
}

var exampleDashboardWithAlert = `{
    "annotations": {
        "list": [
            {
                "builtIn": 1,
                "datasource": "-- Grafana --",
                "enable": true,
                "hide": true,
                "iconColor": "rgba(0, 211, 255, 1)",
                "name": "Annotations & Alerts",
                "type": "dashboard"
            }
        ]
    },
    "editable": true,
    "gnetId": null,
    "graphTooltip": 0,
    "id": 1,
    "links": [
    ],
    "panels": [
        {
            "alert": {
                "alertRuleTags": {
                },
                "conditions": [
                    {
                        "evaluator": {
                            "params": [
                                1
                            ],
                            "type": "lt"
                        },
                        "operator": {
                            "type": "and"
                        },
                        "query": {
                            "params": [
                                "A",
                                "10s",
                                "now"
                            ]
                        },
                        "reducer": {
                            "params": [
                            ],
                            "type": "last"
                        },
                        "type": "query"
                    }
                ],
                "executionErrorState": "alerting",
                "for": "10s",
                "frequency": "1s",
                "handler": 1,
                "message": "This is the message",
                "name": "Panel Title alert",
                "noDataState": "no_data",
                "notifications": [
                    {
                        "uid": "WbP9r0jMk"
                    },
                    {
                        "uid": "TYHj90CMk"
                    },
                    {
                        "id": 3
                    },
                    {
                        "id": 9
                    }
                ]
            },
            "datasource": null,
            "fieldConfig": {
                "defaults": {
                    "color": {
                        "mode": "palette-classic"
                    },
                    "custom": {
                        "axisLabel": "",
                        "axisPlacement": "auto",
                        "barAlignment": 0,
                        "drawStyle": "line",
                        "fillOpacity": 0,
                        "gradientMode": "none",
                        "hideFrom": {
                            "graph": false,
                            "legend": false,
                            "tooltip": false
                        },
                        "lineInterpolation": "linear",
                        "lineWidth": 1,
                        "pointSize": 5,
                        "scaleDistribution": {
                            "type": "linear"
                        },
                        "showPoints": "auto",
                        "spanNulls": false,
                        "stacking": {
                            "group": "A",
                            "mode": "none"
                        },
                        "thresholdsStyle": {
                            "mode": "off"
                        }
                    },
                    "mappings": [
                    ],
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {
                                "color": "green",
                                "value": null
                            },
                            {
                                "color": "red",
                                "value": 80
                            }
                        ]
                    }
                },
                "overrides": [
                ]
            },
            "gridPos": {
                "h": 9,
                "w": 12,
                "x": 0,
                "y": 0
            },
            "id": 2,
            "options": {
                "legend": {
                    "calcs": [
                    ],
                    "displayMode": "list",
                    "placement": "bottom"
                },
                "tooltipOptions": {
                    "mode": "single"
                }
            },
            "targets": [
                {
                    "exemplar": true,
                    "expr": "up",
                    "interval": "",
                    "legendFormat": "",
                    "refId": "A"
                }
            ],
            "thresholds": [
                {
                    "colorMode": "critical",
                    "op": "lt",
                    "value": 1,
                    "visible": true
                }
            ],
            "title": "Panel Title",
            "type": "timeseries"
        }
    ],
    "schemaVersion": 29,
    "style": "dark",
    "tags": [
    ],
    "templating": {
        "list": [
        ]
    },
    "time": {
        "from": "now-6h",
        "to": "now"
    },
    "timepicker": {
    },
    "timezone": "",
    "title": "New dashboard",
    "uid": "3A8C9ACGz",
    "version": 2
}
`
