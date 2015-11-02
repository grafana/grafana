----
page_title: Dashboard JSON 
page_description: Dashboard JSON Reference
page_keywords: grafana, dashboard, json, documentation
---

# Dashboard JSON

## Overview

A dashboard in Grafana is represented by a JSON object, which stores dashboard metadata, rows of panels, panel queries, etc.

<img class="no-shadow" src="/img/v2/dashboard_json.png">

> To view the JSON of a dashboard, you can click on "Manage dashboard" cog menu and select "View JSON" from it.

## Basic fields

A dashboard JSON object is initialized with the following fields when it is created.

```
{
  "id": null,
  "title": "New dashboard",
  "originalTitle": "New dashboard",
  "tags": [],
  "style": "dark",
  "timezone": "browser",
   "editable": true,
  "hideControls": false,
  "sharedCrosshair": false,
  "rows": [
    {
      "height": "250px",
      "panels": [],
      "title": "Row",
      "collapse": false,
      "editable": true
    }
  ],
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {
    "time_options": [
      "5m",
      "15m",
      "1h",
      "6h",
      "12h",
      "24h",
      "2d",
      "7d",
      "30d"
    ],
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
    ]
  },
  "templating": {
    "list": []
  },
  "annotations": {
    "list": []
  },
  "schemaVersion": 7,
  "version": 0,
  "links": []
}
```
