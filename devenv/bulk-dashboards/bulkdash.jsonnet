{
  "annotations": {
    "enable": false,
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
  "graphTooltip": 1,
  "links": [],
  "panels": [
    {
      "aliasColors": {
        "cpu": "#E24D42",
        "memory": "#1f78c1",
        "statsd.fakesite.counters.session_start.desktop.count": "#6ED0E0"
      },
      "annotate": {
        "enable": false
      },
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": null,
      "editable": true,
      "fill": 3,
      "grid": {
        "max": null,
        "min": 0
      },
      "gridPos": {
        "h": 7,
        "w": 8,
        "x": 0,
        "y": 0
      },
      "id": 4,
      "interactive": true,
      "legend": {
        "avg": false,
        "current": true,
        "max": false,
        "min": true,
        "show": true,
        "total": false,
        "values": false
      },
      "legend_counts": true,
      "lines": true,
      "linewidth": 2,
      "nullPointMode": "connected",
      "options": false,
      "percentage": false,
      "pointradius": 5,
      "points": false,
      "renderer": "flot",
      "resolution": 100,
      "scale": 1,
      "seriesOverrides": [
        {
          "alias": "cpu",
          "fill": 0,
          "lines": true,
          "yaxis": 2,
          "zindex": 2
        },
        {
          "alias": "memory",
          "pointradius": 2,
          "points": true
        }
      ],
      "spaceLength": 10,
      "spyable": true,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "hide": false,
          "refId": "A",
          "target": "alias(movingAverage(scaleToSeconds(apps.fakesite.web_server_01.counters.request_status.code_302.count, 10), 20), 'cpu')"
        },
        {
          "refId": "B",
          "target": "alias(statsd.fakesite.counters.session_start.desktop.count, 'memory')"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeShift": null,
      "timezone": "browser",
      "title": "Memory / CPU",
      "tooltip": {
        "msResolution": false,
        "query_as_alias": true,
        "shared": false,
        "sort": 0,
        "value_type": "cumulative"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "bytes",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "percent",
          "logBase": 1,
          "max": null,
          "min": 0,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      },
      "zerofill": true
    },
    {
      "aliasColors": {
        "logins": "#5195ce",
        "logins (-1 day)": "#447EBC",
        "logins (-1 hour)": "#705da0"
      },
      "annotate": {
        "enable": false
      },
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": null,
      "editable": true,
      "fill": 1,
      "grid": {
        "max": null,
        "min": 0
      },
      "gridPos": {
        "h": 7,
        "w": 8,
        "x": 8,
        "y": 0
      },
      "id": 3,
      "interactive": true,
      "legend": {
        "alignAsTable": false,
        "avg": false,
        "current": true,
        "max": true,
        "min": true,
        "rightSide": false,
        "show": true,
        "total": false,
        "values": false
      },
      "legend_counts": true,
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "connected",
      "options": false,
      "percentage": false,
      "pointradius": 5,
      "points": false,
      "renderer": "flot",
      "resolution": 100,
      "scale": 1,
      "seriesOverrides": [],
      "spaceLength": 10,
      "spyable": true,
      "stack": true,
      "steppedLine": false,
      "targets": [
        {
          "refId": "A",
          "target": "alias(movingAverage(scaleToSeconds(apps.fakesite.web_server_01.counters.requests.count, 1), 2), 'logins')"
        },
        {
          "refId": "B",
          "target": "alias(movingAverage(timeShift(scaleToSeconds(apps.fakesite.web_server_01.counters.requests.count, 1), '1h'), 2), 'logins (-1 hour)')"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeShift": "1h",
      "timezone": "browser",
      "title": "logins",
      "tooltip": {
        "msResolution": false,
        "query_as_alias": true,
        "shared": false,
        "sort": 0,
        "value_type": "cumulative"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      },
      "zerofill": true
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "#629e51",
        "rgba(237, 129, 40, 0.89)",
        "rgba(245, 54, 54, 0.9)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "bytes",
      "gauge": {
        "maxValue": 300,
        "minValue": 0,
        "show": true,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 7,
        "w": 4,
        "x": 16,
        "y": 0
      },
      "id": 22,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": false
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "scale(apps.backend.backend_01.counters.requests.count, 0.4)"
        }
      ],
      "thresholds": "200,270",
      "title": "Memory",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "rgba(245, 54, 54, 0.9)",
        "rgba(237, 129, 40, 0.89)",
        "rgba(50, 172, 45, 0.97)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 0
      },
      "id": 16,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": true
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "apps.backend.backend_02.counters.requests.count"
        }
      ],
      "thresholds": "100,270",
      "title": "Sign ups",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "rgba(245, 54, 54, 0.9)",
        "rgba(237, 129, 40, 0.89)",
        "rgba(50, 172, 45, 0.97)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 3
      },
      "id": 17,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": true
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "apps.backend.backend_04.counters.requests.count"
        }
      ],
      "thresholds": "100,270",
      "title": "Sign outs",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "rgba(245, 54, 54, 0.9)",
        "rgba(237, 129, 40, 0.89)",
        "rgba(50, 172, 45, 0.97)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 6
      },
      "id": 15,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": true
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "scale(apps.backend.backend_01.counters.requests.count, 0.7)"
        }
      ],
      "thresholds": "100,270",
      "title": "Logins",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "aliasColors": {
        "web_server_01": "#badff4",
        "web_server_02": "#5195ce",
        "web_server_03": "#1f78c1",
        "web_server_04": "#0a437c"
      },
      "annotate": {
        "enable": false
      },
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "datasource": null,
      "editable": true,
      "fill": 6,
      "grid": {
        "max": null,
        "min": 0
      },
      "gridPos": {
        "h": 11,
        "w": 16,
        "x": 0,
        "y": 7
      },
      "id": 2,
      "interactive": true,
      "legend": {
        "alignAsTable": false,
        "avg": false,
        "current": false,
        "max": false,
        "min": false,
        "rightSide": false,
        "show": true,
        "total": false,
        "values": false
      },
      "legend_counts": true,
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "connected",
      "options": false,
      "percentage": false,
      "pointradius": 5,
      "points": false,
      "renderer": "flot",
      "resolution": 100,
      "scale": 1,
      "seriesOverrides": [],
      "spaceLength": 10,
      "spyable": true,
      "stack": true,
      "steppedLine": false,
      "targets": [
        {
          "refId": "A",
          "target": "aliasByNode(movingAverage(scaleToSeconds(apps.fakesite.*.counters.requests.count, 1), 2), 2)"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeShift": null,
      "timezone": "browser",
      "title": "server requests",
      "tooltip": {
        "msResolution": false,
        "query_as_alias": true,
        "shared": true,
        "sort": 0,
        "value_type": "cumulative"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "short",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      },
      "zerofill": true
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "#629e51",
        "rgba(237, 129, 40, 0.89)",
        "rgba(245, 54, 54, 0.9)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 300,
        "minValue": 0,
        "show": true,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 5,
        "w": 4,
        "x": 16,
        "y": 7
      },
      "id": 21,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": false
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "scale(apps.backend.backend_01.counters.requests.count, 0.8)"
        }
      ],
      "thresholds": "200,270",
      "title": "Logouts",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "rgba(245, 54, 54, 0.9)",
        "rgba(237, 129, 40, 0.89)",
        "rgba(50, 172, 45, 0.97)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 9
      },
      "id": 18,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": true
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "scale(apps.backend.backend_03.counters.requests.count, 0.3)"
        }
      ],
      "thresholds": "100,270",
      "title": "Support calls",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "#629e51",
        "rgba(237, 129, 40, 0.89)",
        "rgba(245, 54, 54, 0.9)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 300,
        "minValue": 0,
        "show": true,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 6,
        "w": 4,
        "x": 16,
        "y": 12
      },
      "id": 26,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": false
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "scale(apps.backend.backend_01.counters.requests.count, 0.2)"
        }
      ],
      "thresholds": "200,270",
      "title": "Google hits",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": true,
      "colors": [
        "#629e51",
        "rgba(237, 129, 40, 0.89)",
        "rgba(245, 54, 54, 0.9)"
      ],
      "datasource": null,
      "editable": true,
      "error": false,
      "format": "none",
      "gauge": {
        "maxValue": 300,
        "minValue": 0,
        "show": true,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 6,
        "w": 4,
        "x": 20,
        "y": 12
      },
      "id": 24,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": true,
        "lineColor": "rgb(31, 120, 193)",
        "show": false
      },
      "tableColumn": "",
      "targets": [
        {
          "refId": "A",
          "target": "scale(apps.backend.backend_01.counters.requests.count, 0.2)"
        }
      ],
      "thresholds": "200,270",
      "title": "Google hits",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "avg"
    },
    {
      "aliasColors": {
        "upper_25": "#F9E2D2",
        "upper_50": "#F2C96D",
        "upper_75": "#EAB839"
      },
      "annotate": {
        "enable": false
      },
      "bars": true,
      "dashLength": 10,
      "dashes": false,
      "datasource": null,
      "editable": true,
      "fill": 1,
      "grid": {
        "max": null,
        "min": 0
      },
      "gridPos": {
        "h": 11,
        "w": 24,
        "x": 0,
        "y": 18
      },
      "id": 5,
      "interactive": true,
      "legend": {
        "alignAsTable": true,
        "avg": true,
        "current": false,
        "max": false,
        "min": false,
        "rightSide": true,
        "show": true,
        "total": false,
        "values": true
      },
      "legend_counts": true,
      "lines": false,
      "linewidth": 2,
      "nullPointMode": "connected",
      "options": false,
      "percentage": false,
      "pointradius": 5,
      "points": false,
      "renderer": "flot",
      "resolution": 100,
      "scale": 1,
      "seriesOverrides": [],
      "spaceLength": 10,
      "spyable": true,
      "stack": true,
      "steppedLine": false,
      "targets": [
        {
          "refId": "A",
          "target": "aliasByNode(summarize(statsd.fakesite.timers.ads_timer.*, '4min', 'avg'), 4)"
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeShift": null,
      "timezone": "browser",
      "title": "client side full page load",
      "tooltip": {
        "msResolution": false,
        "query_as_alias": true,
        "shared": false,
        "sort": 0,
        "value_type": "cumulative"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "ms",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "format": "short",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      },
      "zerofill": true
    }
  ],
  "refresh": false,
  "schemaVersion": 16,
  "tags": [
    "demo"
  ],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {
    "collapse": false,
    "enable": true,
    "notice": false,
    "now": true,
    "refresh_intervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "1d"
    ],
    "status": "Stable",
    "type": "timepicker"
  },
  "timezone": "browser",
  "title": "Big Dashboard",
  "uid": "000000003",
  "version": 16
}
