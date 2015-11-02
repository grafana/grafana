----
page_title: Dashboard JSON 
page_description: Dashboard JSON Reference
page_keywords: grafana, dashboard, json, documentation
---

# Dashboard JSON

## Overview

A dashboard in Grafana is represented by a JSON object, which stores metadata of its dashboard. Dashboard metadata includes dashboard properties, metadata from rows, panels, template variables, panel queries, etc.

To view the JSON of a dashboard, follow the steps mentioned below:

  1. Go to a dashboard
  2. Click on `Manage dashboard` menu on the top navigation bar
  3. Select `View JSON` from the dropdown menu

## Basic fields

When a user creates a new dashboard, a new dashboard JSON object is initialized with the following fields:

> Note: In the following JSON, id is shown as null which is the default value assigned to it until the dashboard is not saved. Once saved, an integer value is assigned to the `id` field.

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
Each field in the dashboard JSON is explained below with its usage:

| Name | Usage |
| ---- | ----- |
| **id** | unique dashboard id, an integer |
| **title** | current title of dashboard |
| **originalTitle** | title of dashboard when saved for the first time |
| **tags** | an array of strings storing tags associated with dashboard |
| **style** | theme of dashboard, i.e. dark or light |
| **timezone** | timezone of dashboard, i.e. utc or browser |
| **editable** | whether a dashboard is editable or not |
| **hideControls** | whether row controls on the left in green are hidden or not |
| **sharedCrosshair** | TODO |
| **rows** | row metadata, see rows section for details |
| **time** | time range of dashboard, i.e. last 6 hours, last 7 days, etc |
| **timepicker** | timepicker metadata, see timepicker section for details |
| **templating** | templating metadata, see templating section for details |
| **annotations** | annotations metadata, see annotations section for details |
| **schemaVersion** | TODO |
| **version** | TODO |
| **links** | TODO |
