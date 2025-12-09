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
labels:
  products:
    - cloud
    - enterprise
    - oss
title: JSON model
description: View your Grafana dashboard JSON object
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

## Differences between Classic V1 Resource, and V2 Resource schemas

When you export a dashboard as code, there might be multiple options available.
This is because of the evolution of the dashboard JSON schema.

- **V2 Resource**: The current, or v2, JSON schema. This schema is the one used by all dashboards created today. It's also the schema used by any dashboards created in the past using the new editing experience when it was experimental. It uses the Kubernetes resources type structure.
<!--Runs on our app platform which uses resources, of which there are many; it's a resource schema-->
- **Classic**: The classic or v1 JSON schema. This schema was used by dashboards created before the dashboards experience released experimentally in Grafana v 12.0.
- **V1 Resource**: The classic or v1 schema, using the resources structure. The legacy schema is included under the `spec` property of the V1 Resource. This schema is the one used by all dashboards created using the classic schema within the new editing experience.

{{< admonition type="note" >}}
[Observability as Code](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/) works with all versions of the JSON model, and it's fully compatible with version 2.
{{ /admonition }}

## Access and update the JSON model (#view-json)

To access the JSON representation of a dashboard:

1. Toggle on the edit mode switch in the top-right corner of the dashboard.
1. Click the gear icon in the right sidebar and click **Settings** in the secondary sidebar.
1. Select the **JSON Model** tab.
1. Update the JSON structure as needed.
1. Click **Save changes**.

## V2 Resource (JSON schema v2)

{{< admonition type="caution" >}}

Dashboard JSON schema v2 is an [experimental](https://grafana.com/docs/release-life-cycle/) feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).

**Do not enable this feature in production environments as it may result in the irreversible loss of data.**

{{< /admonition >}}

To view the detailed v2 JSON schema, refer to the [Swagger documentation](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2beta1).

### Before you begin

Schema v2 is automatically enabled with the Dynamic Dashboards feature toggle.
To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).
It also requires the new dashboards API feature toggle, `kubernetesDashboards`, to be enabled as well.

For more information on how dashboards behave depending on your feature flag configuration, refer to [Notes and limitations](#notes-and-limitations).

### Notes and limitations

#### Existing dashboards

With schema v2 enabled, you can still open and view your pre-existing dashboards.
Upon saving, they’ll be updated to the new schema where you can take advantage of the new features and functionalities.

#### Dashboard behavior with disabled feature flags

If you disable the Dynamic dashboards or `kubernetesDashboards` feature flags, you should be aware of how dashboards will behave.

##### Disable Dynamic dashboards

If the Dynamic dashboards feature toggle is disabled, depending on how the dashboard was built, it will behave differently:

- Dashboards built on the new schema through the UI - View only
- Dashboards built on Schema v1 - View and edit
- Dashboards built on the new schema by way of Terraform or the CLI - View and edit
- Provisioned dashboards built on the new schema - View and edit, but the edit experience will be the old experience

##### Disable Dynamic dashboards and `kubernetesDashboards`

You’ll be unable to view or edit dashboards created or updated in the new schema.

#### Import and export

From the UI, dashboards created on schema v2 can be exported and imported like other dashboards.
When you export them to use in another instance, references of data sources are not persisted but data source types are.
You’ll have the option to select the data source of your choice in the import UI.

## V1 Resource

To view the detailed V1 Resource schema, refer to the [Swagger documentation](https://play.grafana.org/swagger?api=dashboard.grafana.app-v1beta1).

When you open a dashboard created before (version?) using the new editing experience, the schema uses the Kubernetes-style structure and includes the classic schema (v1 schema) under the `spec` property:

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

## Classic JSON (Schema v1) {#json-fields}

Before (version?), when you created a new dashboard, a new dashboard JSON object was initialized with the following fields:

{{< admonition type="note" >}}
In the following JSON, id is shown as null which is the default value assigned to it until a dashboard is saved. Once a dashboard is saved, an integer value is assigned to the `id` field.
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