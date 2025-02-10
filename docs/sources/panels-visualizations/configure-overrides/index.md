---
aliases:
  - ../panels/configure-overrides/
  - ../panels/field-overrides/
  - ../panels/override-field-values/
  - ../panels/override-field-values/about-field-overrides/
  - ../panels/override-field-values/add-a-field-override/
  - ../panels/override-field-values/delete-a-field-override/
  - ../panels/override-field-values/edit-field-override/
  - ../panels/override-field-values/view-field-override/
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure field overrides
title: Configure field overrides
description: Configure field overrides to customize visualization settings
weight: 110
refs:
  state-timeline:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline/
  gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge/
  bar-gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-gauge/
  canvas:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/canvas/
  candlestick:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/candlestick/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick/
  status-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/status-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history/
  heatmap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/heatmap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/heatmap/
  rename-by-regex-transformation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#rename-by-regex
    - pattern: /docs/grafana-cloud
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/#rename-by-regex
  histogram:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/histogram/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram/
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table/
  bar-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart/
  pie-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/pie-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  geomap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap/
  xy-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/xy-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/xy-chart/
  trend:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/trend/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend/
  stat:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/stat/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat/
---

# Configure field overrides

Overrides allow you to customize visualization settings for specific fields or series. When you add an override rule, it targets a particular set of fields and lets you define multiple options for how that field is displayed.

For example, you can override the default unit measurement for all fields that include the text "bytes" by adding an override using the **Fields with name matching regex** matcher and then the **Standard options > Unit** setting to the override rule:

![Field with unit override](/media/docs/grafana/panels-visualizations/screenshot-unit-override-v10.3.png)

After you've set them, your overrides appear in both the **All** and **Overrides** tabs of the panel editor pane:

![All and Overrides tabs of panel editor pane](/media/docs/grafana/panels-visualizations/screenshot-all-overrides-tabs-v11.png)

## Supported visualizations

You can configure field overrides for the following visualizations:

{{< column-list >}}

- [Bar chart](ref:bar-chart)
- [Bar gauge](ref:bar-gauge)
- [Candlestick](ref:candlestick)
- [Canvas](ref:canvas)
- [Gauge](ref:gauge)
- [Geomap](ref:geomap)
- [Heatmap](ref:heatmap)
- [Histogram](ref:histogram)
- [Pie chart](ref:pie-chart)
- [Stat](ref:stat)
- [State timeline](ref:state-timeline)
- [Status history](ref:status-history)
- [Table](ref:table)
- [Time series](ref:time-series)
- [Trend](ref:trend)
- [XY chart](ref:xy-chart)

{{< /column-list >}}

## Override rules

You can choose from five types of override rules, which are described in the following sections.

### Fields with name

Select a field from the list of all available fields. Properties you add to this type of rule are only applied to this single field.

### Fields with name matching regex

Specify fields to override with a regular expression. Properties you add to this type of rule are applied to all fields where the field name matches the regular expression. This override doesn't rename the field; to do this, use the [Rename by regex transformation](ref:rename-by-regex-transformation).

### Fields with type

Select fields by type, such as string, numeric, or time. Properties you add to this type of rule are applied to all fields that match the selected type.

### Fields returned by query

Select all fields returned by a specific query, such as A, B, or C. Properties you add to this type of rule are applied to all fields returned by the selected query.

### Fields with values

Select all fields returned by your defined reducer condition, such as **Min**, **Max**, **Count**, **Total**. Properties you add to this type of rule are applied to all fields returned by the selected condition.

## Examples

The following examples demonstrate how you can use override rules to alter the display of fields in visualizations.

### Example 1: Format temperature

The following result set is a data frame that consists of two fields: time and temperature.

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |    45.0     |
| 2020-01-02 03:05:00 |    47.0     |
| 2020-01-02 03:06:00 |    48.0     |

You can apply field options to each field (column) of this structure to alter the way its values are displayed. For example, you can set the following override rule:

- Rule: **Fields with type**
- Field: temperature
- Override property: **Standard options > Unit**
  - Selection: **Temperature > Celsius**

This results in the following table:

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |   45.0 °C   |
| 2020-01-02 03:05:00 |   47.0 °C   |
| 2020-01-02 03:06:00 |   48.0 °C   |

In addition, the decimal place isn't required, so you can remove it by adding another override property that changes the **Standard options > Decimals** setting from **auto** to `0`. That results in the following table:

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |    45 °C    |
| 2020-01-02 03:05:00 |    47 °C    |
| 2020-01-02 03:06:00 |    48 °C    |

### Example 2: Format temperature and humidity

The following result set is a data frame that consists of four fields: time, high temp, low temp, and humidity.

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45.0      | 30.0     | 67       |
| 2020-01-02 03:05:00 | 47.0      | 34.0     | 68       |
| 2020-01-02 03:06:00 | 48.0      | 31.0     | 68       |

Use the following override rule and properties to add the **Celsius** unit option and remove the decimal place:

- Rule: **Fields with type**
- Field: temperature
- Override property: **Standard options > Unit**
  - Selection: **Temperature > Celsius**
- Override property: **Standard options > Decimals**
  -Change setting from **auto** to `0`

This results in the following table:

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45 °C     | 30 °C    | 67 °C    |
| 2020-01-02 03:05:00 | 47 °C     | 34 °C    | 68 °C    |
| 2020-01-02 03:06:00 | 48 °C     | 31 °C    | 68 °C    |

The temperature fields are displaying correctly, but the humidity has incorrect units. You can fix this by applying a **Misc > Percent (0-100)** override to the humidity field. This results in the following table:

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45 °C     | 30 °C    | 67%      |
| 2020-01-02 03:05:00 | 47 °C     | 34 °C    | 68%      |
| 2020-01-02 03:06:00 | 48 °C     | 31 °C    | 68%      |

## Add a field override

To add a field override, follow these steps:

1. Navigate to the panel to which you want to add the data link.
1. Hover over any part of the panel to display the menu icon in the upper-right corner.
1. Click the menu icon and select **Edit** to open the panel editor.
1. At the bottom of the panel editor pane, click **Add field override**.
1. Select the fields to which the override will be applied:
   - **Fields with name**
   - **Fields with name matching regex**
   - **Fields with type**
   - **Fields returned by query**
   - **Fields with values**
1. Click **Add override property**.
1. Select the field option that you want to apply.
1. Continue to add overrides to this field by clicking **Add override property**.
1. Add as many overrides as you need.
1. When you're finished, click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.

## Edit a field override

To edit a field override, follow these steps:

1. Navigate to the panel to which you want to add the data link.
1. Hover over any part of the panel to display the menu icon in the upper-right corner.
1. Click the menu icon and select **Edit** to open the panel editor.
1. In the panel editor pane, click the **Overrides** tab.
1. Locate the override you want to change.
1. Perform any of the following tasks:
   - Edit settings on existing overrides or field selection parameters.
   - Delete existing override properties by clicking the **X** next to the property.
   - Delete an override entirely by clicking the trash icon at the top-right corner.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.

The changes you make take effect immediately.
