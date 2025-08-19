---
description: A reference for the JSON dashboard schemas used with Observability as Code, including the experimental V2 schema.
keywords:
  - configuration
  - as code
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - cloud
    - enterprise
    - oss
title: JSON schema v2
weight: 200
---

# Dashboard JSON schema v2

{{< admonition type="caution" >}}

Dashboard JSON schema v2 is an [experimental](https://grafana.com/docs/release-life-cycle/) feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).

**Do not enable this feature in production environments as it may result in the irreversible loss of data.**

{{< /admonition >}}

Grafana dashboards are represented as JSON objects that store metadata, panels, variables, and settings.

Observability as Code works with all versions of the JSON model, and it's fully compatible with version 2.

## Before you begin

Schema v2 is automatically enabled with the Dynamic Dashboards feature toggle.
To get early access to this feature, request it through [this form](https://docs.google.com/forms/d/e/1FAIpQLSd73nQzuhzcHJOrLFK4ef_uMxHAQiPQh1-rsQUT2MRqbeMLpg/viewform?usp=dialog).
It also requires the new dashboards API feature toggle, `kubernetesDashboards`, to be enabled as well.

For more information on how dashboards behave depending on your feature flag configuration, refer to [Notes and limitations](#notes-and-limitations).

## Accessing the JSON Model

To view the JSON representation of a dashboard:

1. Toggle on the edit mode switch in the top-right corner of the dashboard.
1. Click the gear icon in the top navigation bar to go to **Settings**.
1. Select the **JSON Model** tab.
1. Copy or edit the JSON structure as needed.

## JSON fields

```json
{
  "annotations": [],
  "cursorSync": "Off",
  "editable": true,
  "elements": {},
  "layout": {
    "kind": GridLayout, // Can also be AutoGridLayout, RowsLayout, or TabsLayout
    "spec": {
      "items": []
    }
  },
  "links": [],
  "liveNow": false,
  "preload": false,
  "tags": [], // Tags associated with the dashboard.
  "timeSettings": {
    "autoRefresh": "",
    "autoRefreshIntervals": [
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
    "fiscalYearStartMonth": 0,
    "from": "now-6h",
    "hideTimepicker": false,
    "timezone": "browser",
    "to": "now"
  },
  "title": "",
  "variables": []
},
```

The dashboard JSON sample shown uses the default `GridLayoutKind`.
The JSON in a new dashboard for the other three layout options, `AutoGridLayout`, `RowsLayout`, and `TabsLayout`, are as follows:

**`AutoGridLayout`**

```json
  "layout": {
    "kind": "AutoGridLayout",
    "spec": {
      "columnWidthMode": "standard",
      "items": [],
      "fillScreen": false,
      "maxColumnCount": 3,
      "rowHeightMode": "standard"
    }
  },
```

**`RowsLayout`**

```json
  "layout": {
    "kind": "RowsLayout",
    "spec": {
      "rows": []
  },
```

**`TabsLayout`**

```json
  "layout": {
    "kind": "TabsLayout",
    "spec": {
      "tabs": []
  },
```

### `DashboardSpec`

The following table explains the usage of the dashboard JSON fields.
The table includes default and other fields:

<!-- prettier-ignore-start -->

| Name         | Usage                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| annotations  | Contains the list of annotations that are associated with the dashboard. |
| cursorSync   | Dashboard cursor sync behavior.<ul><li>`Off` - No shared crosshair or tooltip (default)</li><li>`Crosshair` - Shared crosshair</li><li>`Tooltip` - Shared crosshair and shared tooltip</li></ul>  |
| editable     | bool. Whether or not a dashboard is editable. |
| elements     | Contains the list of elements included in the dashboard. Supported dashboard elements are: PanelKind and LibraryPanelKind. |
| layout       | The dashboard layout. Supported layouts are:<ul><li>GridLayoutKind</li><li>AutoGridLayoutKind</li><li>RowsLayoutKind</li><li>TabsLayoutKind</li></ul>  |
| links        | Links with references to other dashboards or external websites. |
| liveNow      | bool. When set to `true`, the dashboard redraws panels at an interval matching the pixel width. This keeps data "moving left" regardless of the query refresh rate. This setting helps avoid dashboards presenting stale live data.    |
| preload      | bool. When set to `true`, the dashboard loads all panels when the dashboard is loaded. |
| tags         | Contains the list of tags associated with dashboard. |
| timeSettings | All time settings for the dashboard. |
| title        | Title of the dashboard.   |
| variables    | Contains the list of configured template variables. |

<!-- prettier-ignore-end -->

### `annotations`

The configuration for the list of annotations that are associated with the dashboard.
For the JSON and field usage notes, refer to the [annotations schema documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/annotations-schema/).

### `elements`

Dashboards can contain the following elements:

- [PanelKind](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/panel-schema/)
- [LibraryPanelKind](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/librarypanel-schema/)

### `layout`

Dashboards can have four layout options:

- [GridLayoutKind](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/layout-schema/#gridlayoutkind)
- [AutoGridLayoutKind](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/layout-schema/#autogridlayoutkind)
- [RowsLayoutKind](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/layout-schema/#rowslayoutkind)
- [TabsLayoutKind](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/layout-schema/#tabslayoutkind)

For the JSON and field usage notes about each of these, refer to the [layout schema documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/layout-schema/).

### `links`

The configuration for links with references to other dashboards or external websites.

For the JSON and field usage notes, refer to the [links schema documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/links-schema/).

### `tags`

The tags associated with the dashboard:

` [...string]`

### `timesettings`

The `TimeSettingsSpec` defines the default time configuration for the time picker and the refresh picker for the specific dashboard.
For the JSON and field usage notes about the `TimeSettingsSpec`, refer to the [timesettings schema documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/timesettings-schema/).

### `variables`

The `variables` schema defines which variables are used in the dashboard.

There are eight variables types:

- QueryVariableKind
- TextVariableKind
- ConstantVariableKind
- DatasourceVariableKind
- IntervalVariableKind
- CustomVariableKind
- GroupByVariableKind
- AdhocVariableKind

For the JSON and field usage notes about the `variables` spec, refer to the [variables schema documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/schema-v2/variables-schema/).

## Notes and limitations

### Existing dashboards

With schema v2 enabled, you can still open and view your pre-existing dashboards.
Upon saving, they’ll be updated to the new schema where you can take advantage of the new features and functionalities.

### Dashboard behavior with disabled feature flags

If you disable the Dynamic dashboards or `kubernetesDashboards` feature flags, you should be aware of how dashboards will behave.

#### Disable Dynamic dashboards

If the Dynamic dashboards feature toggle is disabled, depending on how the dashboard was built, it will behave differently:

- Dashboards built on the new schema through the UI - View only
- Dashboards built on Schema v1 - View and edit
- Dashboards built on the new schema by way of Terraform or the CLI - View and edit
- Provisioned dashboards built on the new schema - View and edit, but the edit experience will be the old experience

#### Disable Dynamic dashboards and `kubernetesDashboards`

You’ll be unable to view or edit dashboards created or updated in the new schema.

### Import and export

From the UI, dashboards created on schema v2 can be exported and imported like other dashboards.
When you export them to use in another instance, references of data sources are not persisted but data source types are.
You’ll have the option to select the data source of your choice in the import UI.
