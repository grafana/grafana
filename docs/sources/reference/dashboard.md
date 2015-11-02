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

## JSON fields

When a user creates a new dashboard, a new dashboard JSON object is initialized with the following fields:

> Note: In the following JSON, id is shown as null which is the default value assigned to it until a dashboard is saved. Once a dashboard is saved, an integer value is assigned to the `id` field.

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
  "rows": [],
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {
    "time_options": [],
    "refresh_intervals": []
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
| **tags** | tags associated with dashboard, an array of strings |
| **style** | theme of dashboard, i.e. `dark` or `light` |
| **timezone** | timezone of dashboard, i.e. `utc` or `browser` |
| **editable** | whether a dashboard is editable or not |
| **hideControls** | whether row controls on the left in green are hidden or not |
| **sharedCrosshair** | TODO |
| **rows** | row metadata, see [rows section](/dashboard/#rows) for details |
| **time** | time range for dashboard, i.e. last 6 hours, last 7 days, etc |
| **timepicker** | timepicker metadata, see [timepicker section](/dashboard/#timepicker) for details |
| **templating** | templating metadata, see [templating section](/dashboard/#templating) for details |
| **annotations** | annotations metadata, see [annotations section](/dashboard/#annotations) for details |
| **schemaVersion** | TODO |
| **version** | TODO |
| **links** | TODO |

### rows

`rows` field represents an array of JSON object representing each row in a dashboard, such as shown below:

```
 "rows": [
    {
      "collapse": false,
      "editable": true,
      "height": "200px",
      "panels": [],
      "title": "New row"
    },
    {
      "collapse": true,
      "editable": true,
      "height": "300px",
      "panels": [],
      "title": "New row"
    }
  ]
```

Usage of the fields is explained below:

| Name | Usage |
| ---- | ----- |
| **collapse** | whether row is collapsed or not |
| **editable** | whether a row is editable or not |
| **height** | height of the row in pixels |
| **panels** | panels metadata, see [panels section](/dashboard/#panels) for details |
| **title** | title of row |

#### panels

TODO

### timepicker

TODO

### templating

TODO

### annotations

TODO
