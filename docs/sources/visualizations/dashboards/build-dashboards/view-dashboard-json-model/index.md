---
aliases:
  - ../../../reference/dashboard/ # /docs/grafana/next/reference/dashboard/
  - ../../../dashboards/json-model/ # /docs/grafana/next/dashboards/json-model/
  - ../../../dashboards/build-dashboards/view-dashboard-json-model/ # /docs/grafana/next/dashboards/build-dashboards/view-dashboard-json-model/
  - ../../../as-code/observability-as-code/schema-v2/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/
  - ../../../as-code/observability-as-code/schema-v2/annotations-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/annotations-schema/
  - ../../../as-code/observability-as-code/schema-v2/panel-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/panel-schema/
  - ../../../as-code/observability-as-code/schema-v2/librarypanel-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/librarypanel-schema/
  - ../../../as-code/observability-as-code/schema-v2/layout-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/layout-schema/
  - ../../../as-code/observability-as-code/schema-v2/links-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/links-schema/
  - ../../../as-code/observability-as-code/schema-v2/timesettings-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/timesettings-schema/
  - ../../../as-code/observability-as-code/schema-v2/variables-schema/ # /docs/grafana/latest/as-code/observability-as-code/schema-v2/variables-schema/
  - ../../../observability-as-code/schema-v2/ # /docs/grafana/latest/observability-as-code/schema-v2/
  - ../../../../next/observability-as-code/schema-v2/annotations-schema/ # /docs/grafana/next/observability-as-code/schema-v2/annotations-schema/
  - ../../../../next/observability-as-code/schema-v2/panel-schema/ # /docs/grafana/next/observability-as-code/schema-v2/panel-schema/
  - ../../../../next/observability-as-code/schema-v2/librarypanel-schema/ # /docs/grafana/next/observability-as-code/schema-v2/librarypanel-schema/
  - ../../../../next/observability-as-code/schema-v2/layout-schema/ # /docs/grafana/next/observability-as-code/schema-v2/layout-schema/
  - ../../../../next/observability-as-code/schema-v2/links-schema/ # /docs/grafana/next/observability-as-code/schema-v2/links-schema/
  - ../../../../next/observability-as-code/schema-v2/timesettings-schema/ # /docs/grafana/next/observability-as-code/schema-v2/timesettings-schema/
  - ../../../../next/observability-as-code/schema-v2/variables-schema/ # /docs/grafana/next/observability-as-code/schema-v2/variables-schema/
keywords:
  - grafana
  - dashboard
  - documentation
  - json
  - model
  - schema v2
  - v1 resource
  - v2 resource
  - classic
labels:
  products:
    - cloud
    - enterprise
    - oss
title: JSON model
description: View and update your Grafana dashboard JSON object
weight: 700
refs:
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
---

# Dashboard JSON model

Grafana dashboards are represented as JSON objects that store metadata, panels, variables, and settings.

## Different dashboard schema models

There are currently three dashboard JSON schema models:

- [Classic](#classic-model) - The default schema in self-managed Grafana. (Also referred to as the JSON schema v1.).
- [V1 Resource](#v1-resource-model) - The Classic dashboard schema formatted as a Kubernetes-style resource. The `spec` property of the schema contains the Classic-style model of the schema. Dashboards created using the Classic model can be exported using either that model or this one.
- [V2 Resource](#v2-resource-model) - Kubernetes-style resource schema. The default schema in Grafana Cloud. (Also referred to as the JSON schema v2.)

{{< admonition type="note" >}}
[Observability as Code](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/) works with all versions of the JSON model, and it's fully compatible with version 2.
{{< /admonition >}}

## Access and update the JSON model (#view-json)

To access the JSON representation of a dashboard:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click the gear icon in the right sidebar and click **Settings** in the secondary sidebar.
1. Select the **JSON Model** tab.
1. Update the JSON structure as needed.
1. Click **Save changes**.

## Classic model

When you create a new dashboard in self-managed Grafana, a new dashboard JSON object was initialized with the following fields:

{{< admonition type="note" >}}
In the following JSON, id is shown as null which is the default value assigned to it until a dashboard is saved.
After a dashboard is saved, an integer value is assigned to the `id` field.
{{< /admonition >}}

```json
{
  "id": null,
  "uid": "cLV5GDCkz",
  "title": "New dashboard",
  "tags": [],
  "timezone": "browser",
  "editable": true,
  "graphTooltip": 1,
  "panels": [],
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {
    "refresh_intervals": []
  },
  "templating": {
    "list": []
  },
  "annotations": {
    "list": []
  },
  "refresh": "5s",
  "schemaVersion": 17,
  "version": 0,
  "links": []
}
```

Each field in the dashboard JSON is explained below with its usage:

<!--prettier-ignore-start -->

| Name              | Usage                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **id**            | unique numeric identifier for the dashboard. (generated by the db) |
| **uid**           | unique dashboard identifier that can be generated by anyone. string (8-40) |
| **title**         | current title of dashboard |
| **tags**          | tags associated with dashboard, an array of strings |
| **style**         | theme of dashboard, i.e. `dark` or `light` |
| **timezone**      | timezone of dashboard, i.e. `utc` or `browser` |
| **editable**      | whether a dashboard is editable or not |
| **graphTooltip**  | 0 for no shared crosshair or tooltip (default), 1 for shared crosshair, 2 for shared crosshair AND shared tooltip |
| **time**          | time range for dashboard, i.e. last 6 hours, last 7 days, etc |
| **timepicker**    | timepicker metadata, see [timepicker section](#timepicker) for details |
| **templating**    | templating metadata, see [templating section](#templating) for details |
| **annotations**   | annotations metadata, see [annotations](ref:annotations) for how to add them |
| **refresh**       | auto-refresh interval|
| **schemaVersion** | version of the JSON schema (integer), incremented each time a Grafana update brings changes to said schema |
| **version**       | version of the dashboard (integer), incremented each time the dashboard is updated |
| **panels**        | panels array, see below for detail. |

<!--prettier-ignore-end -->

### Panels

Panels are the building blocks of a dashboard. It consists of data source queries, type of graphs, aliases, etc. Panel JSON consists of an array of JSON objects, each representing a different panel. Most of the fields are common for all panels but some fields depend on the panel type. Following is an example of panel JSON of a text panel.

```json
"panels": [
  {
    "type": "text",
    "title": "Panel Title",
    "gridPos": {
      "x": 0,
      "y": 0,
      "w": 12,
      "h": 9
    },
    "id": 4,
    "mode": "markdown",
    "content": "# title"
  }
```

### Panel size and position

The gridPos property describes the panel size and position in grid coordinates.

- `w` 1-24 (the width of the dashboard is divided into 24 columns)
- `h` In grid height units, each represents 30 pixels.
- `x` The x position, in same unit as `w`.
- `y` The y position, in same unit as `h`.

The grid has a negative gravity that moves panels up if there is empty space above a panel.

### timepicker

```json
"timepicker": {
    "collapse": false,
    "enable": true,
    "notice": false,
    "now": true,
    "hidden": false,
    "nowDelay": "",
    "quick_ranges": [
      {
        "display": "Last 6 hours",
        "from": "now-6h",
        "to": "now"
      },
      {
        "display": "Last 7 days",
        "from": "now-7d",
        "to": "now"
      }
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
    ],
    "status": "Stable",
    "type": "timepicker"
  }
```

Usage of the fields is explained below:

<!--prettier-ignore-start -->

| Name                  | Usage                                                     |
| --------------------- | --------------------------------------------------------- |
| **collapse**          | whether timepicker is collapsed or not                    |
| **enable**            | whether timepicker is enabled or not                      |
| **notice**            |                                                           |
| **now**               |                                                           |
| **hidden**            | whether timepicker is hidden or not                       |
| **nowDelay**          | override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.                                                   |
| **quick_ranges**      | custom quick ranges                                       |
| **refresh_intervals** | interval options available in the refresh picker dropdown |
| **status**            |                                                           |
| **type**              |                                                           |

<!--prettier-ignore-end -->

### templating

The `templating` field contains an array of template variables with their saved values along with some other metadata, for example:

```json
 "templating": {
    "enable": true,
    "list": [
      {
        "allFormat": "wildcard",
        "current": {
          "tags": [],
          "text": "prod",
          "value": "prod"
        },
        "datasource": null,
        "includeAll": true,
        "name": "env",
        "options": [
          {
            "selected": false,
            "text": "All",
            "value": "*"
          },
          {
            "selected": false,
            "text": "stage",
            "value": "stage"
          },
          {
            "selected": false,
            "text": "test",
            "value": "test"
          }
        ],
        "query": "tag_values(cpu.utilization.average,env)",
        "refresh": false,
        "type": "query"
      },
      {
        "allFormat": "wildcard",
        "current": {
          "text": "apache",
          "value": "apache"
        },
        "datasource": null,
        "includeAll": false,
        "multi": false,
        "multiFormat": "glob",
        "name": "app",
        "options": [
          {
            "selected": true,
            "text": "tomcat",
            "value": "tomcat"
          },
          {
            "selected": false,
            "text": "cassandra",
            "value": "cassandra"
          }
        ],
        "query": "tag_values(cpu.utilization.average,app)",
        "refresh": false,
        "regex": "",
        "type": "query"
      }
    ]
  }
```

Usage of the above mentioned fields in the templating section is explained below:

| Name            | Usage                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **enable**      | whether templating is enabled or not                                                                    |
| **list**        | an array of objects each representing one template variable                                             |
| **allFormat**   | format to use while fetching all values from data source, eg: `wildcard`, `glob`, `regex`, `pipe`, etc. |
| **current**     | shows current selected variable text/value on the dashboard                                             |
| **data source** | shows data source for the variables                                                                     |
| **includeAll**  | whether all value option is available or not                                                            |
| **multi**       | whether multiple values can be selected or not from variable value list                                 |
| **multiFormat** | format to use while fetching timeseries from data source                                                |
| **name**        | name of variable                                                                                        |
| **options**     | array of variable text/value pairs available for selection on dashboard                                 |
| **query**       | data source query used to fetch values for a variable                                                   |
| **refresh**     | configures when to refresh a variable                                                                   |
| **regex**       | extracts part of a series name or metric node segment                                                   |
| **type**        | type of variable, i.e. `custom`, `query` or `interval`                                                  |

## V1 Resource model

The V1 Resource schema model formats the [Classic JSON model](#classic-model) schema as a Kubernetes-style resource.
The `spec` property of the schema contains the Classic-style model of the schema.

<!-- Following text is from limitations section of schema v2 docs. What do you see when you open a dashboard that was created before DD was enabled? A v1 Resource schema or a V2 resource schema?
  With schema v2 enabled, you can still open and view your pre-existing dashboards.
  Upon saving, they’ll be updated to the new schema where you can take advantage of the new features and functionalities.-->

Dashboards created using the Classic model can be exported using either this model or the Classic one.

The following code snippet shows the fields included in the V1 Resource model.
For the detailed V1 Resource schema, refer to the [Swagger documentation](https://play.grafana.org/swagger?api=dashboard.grafana.app-v1beta1).

```json
{
  "apiVersion": "dashboard.grafana.app/v1beta1",
  "kind": "Dashboard",
  "metadata": {
    "name": "isnt5ss",
    "namespace": "stacks-521104",
    "uid": "92674c0e-0360-4bb4-99ab-fb150581376d",
    "resourceVersion": "1764705030717045",
    "generation": 1,
    "creationTimestamp": "2025-12-02T19:50:30Z",
    "labels": {
      "grafana.app/deprecatedInternalID": "1329"
    },
    "annotations": {
      "grafana.app/createdBy": "user:u000000002",
      "grafana.app/folder": "",
      "grafana.app/saved-from-ui": "Grafana Cloud (instant)"
    }
  },
  "spec": {
    "annotations": {
      "list": [
        {
          "builtIn": 1,
          "datasource": {
            "type": "grafana",
            "uid": "-- Grafana --"
          },
          "enable": true,
          "hide": true,
          "iconColor": "rgba(0, 211, 255, 1)",
          "name": "Annotations & Alerts",
          "type": "dashboard"
        }
      ]
    },
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 0,
    "id": 1329,
    "links": [],
    "panels": [],
    "preload": false,
    "schemaVersion": 42,
    "tags": [],
    "templating": {
      "list": []
    },
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "timepicker": {},
    "timezone": "Africa/Abidjan",
    "title": "Graphite suggestions",
    "uid": "isnt5ss",
    "version": 1,
    "weekStart": ""
  },
  "status": {}
}
```

## V2 Resource model

{{< docs/public-preview product="Dashboard JSON schema v2" >}}

For the detailed V2 Resource model schema, refer to the [Swagger documentation](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2beta1).
