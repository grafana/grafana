---
aliases:
  - ../linking/data-link-variables/
  - ../linking/data-links/
  - ../panels/configure-data-links/
  - ../reference/datalinks/
  - ../variables/url-variables/
  - ../variables/variable-types/url-variables/
keywords:
  - grafana
  - url variables
  - variables
  - data link
  - documentation
  - playlist
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure data links
title: Configure data links
description: Configure data links to create links between dashboards and link to external resources
weight: 80
refs:
  global-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#**from-and-**to
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#**from-and-**to
  heatmap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/heatmap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/heatmap/
  templates-and-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  status-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/status-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history/
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
  gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge/
  google-cloud-monitoring:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/#deep-link-from-grafana-panels-to-the-google-cloud-console-metrics-explorer
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/google-cloud-monitoring/query-editor/#deep-link-from-grafana-panels-to-the-google-cloud-console-metrics-explorer
  state-timeline:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline/
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
  geomap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap/
  stat:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/stat/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  cloudwatch:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/#deep-link-grafana-panels-to-the-cloudwatch-console-1
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/aws-cloudwatch/query-editor/#deep-link-grafana-panels-to-the-cloudwatch-console-1
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table/
  histogram:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/histogram/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram/
  pie-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/pie-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart/
  bar-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart/
---

# Configure data links

Data links allow you to link to other panels, dashboards, and external resources while maintaining the context of the source panel. You can create links that include the series name or even the value under the cursor. For example, if your visualization shows four servers, you can add a data link to one or two of them.

The link itself is accessible in different ways depending on the visualization. For the time series visualization you need to click a data point or line:

![Time series visualization with a data link displayed](/media/docs/grafana/panels-visualizations/screenshot-time-series-data-link-v10.3.png)

For visualizations like stat, gauge, or bar gauge you can click anywhere on the visualization to open the context menu:

![Stat visualization with a data link displayed](/media/docs/grafana/panels-visualizations/screenshot-stat-data-link-v10.3.png)

If there's only one data link in the visualization, clicking anywhere on the visualization opens the link rather than the context menu.

## Supported visualizations

You can configure data links for the following visualizations:

|                                |                                      |                                      |
| ------------------------------ | ------------------------------------ | ------------------------------------ |
| [Bar chart](ref:bar-chart)     | [Heatmap](ref:heatmap)               | [Status history](ref:status-history) |
| [Bar gauge](ref:bar-gauge)     | [Histogram](ref:histogram)           | [Table](ref:table)                   |
| [Candlestick](ref:candlestick) | [Pie chart](ref:pie-chart)           | [Time series](ref:time-series)       |
| [Canvas](ref:canvas)           | [Stat](ref:stat)                     | [Trend](ref:trend)                   |
| [Gauge](ref:gauge)             | [State timeline](ref:state-timeline) | [XY chart](ref:xy-chart)             |
| [Geomap](ref:geomap)           |                                      |                                      |

## Data link variables

Variables in data links let you send people to a detailed dashboard with preserved data filters. For example, you could use variables to specify a label, time range, series, or variable selection.

To see a list of available variables, enter `$` in the data link **URL** field.

{{% admonition type="note" %}}
These variables changed in 6.4 so if you have an older version of Grafana, then use the version picker to select docs for an older version of Grafana.
{{% /admonition %}}

Azure Monitor, [CloudWatch](ref:cloudwatch), and [Google Cloud Monitoring](ref:google-cloud-monitoring) have pre-configured data links called _deep links_.

You can also use template variables in your data links URLs. For more information, refer to [Templates and variables](ref:templates-and-variables).

### Time range panel variables

These variables allow you to include the current time range in the data link URL:

| Variable           | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `__url_time_range` | Current dashboard's time range (for example, `?from=now-6h&to=now`)      |
| `__from`           | For more information, refer to [Global variables](ref:global-variables). |
| `__to`             | For more information, refer to [Global variables](ref:global-variables). |

When you create data links using time range variables like `__url_time_range` in the URL, you have to form the query parameter syntax yourself; that is, you must format the URL by appending query parameters using the question mark (`?`) and ampersand (`&`) syntax. These characters aren't automatically generated.

### Series variables

Series-specific variables are available under `__series` namespace:

| Variable        | Description            |
| --------------- | ---------------------- |
| `__series.name` | Series name to the URL |

### Field variables

Field-specific variables are available under `__field` namespace:

| Variable                 | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `__field.name`           | The name of the field                                                                               |
| `__field.labels.<LABEL>` | Label's value to the URL. If your label contains dots, then use `__field.labels["<LABEL>"]` syntax. |

### Value variables

Value-specific variables are available under `__value` namespace:

| Variable          | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `__value.time`    | Value's timestamp (Unix ms epoch) to the URL (for example, `?time=1560268814105`) |
| `__value.raw`     | Raw value                                                                         |
| `__value.numeric` | Numeric representation of a value                                                 |
| `__value.text`    | Text representation of a value                                                    |
| `__value.calc`    | Calculation name if the value is result of calculation                            |

Using value-specific variables in data links can show different results depending on the set option of Tooltip mode.

When you create data links using time range variables like `__value.time` in the URL, you have to form the query parameter syntax yourself; that is, you must add the question mark (`?`) and ampersand (`&`). These characters aren't automatically generated.

### Data variables

To access values and labels from other fields use:

| Variable                          | Description                                |
| --------------------------------- | ------------------------------------------ |
| `__data.fields[i]`                | Value of field `i` (on the same row)       |
| `__data.fields["NameOfField"]`    | Value of field using name instead of index |
| `__data.fields[1].labels.cluster` | Access labels of another field             |

### Template variables

When linking to another dashboard that uses template variables, select variable values for whoever clicks the link.

`${var-myvar:queryparam}` - where `var-myvar` is the name of the template variable that matches one in the current dashboard that you want to use.

| Variable state           | Result in the created URL           |
| ------------------------ | ----------------------------------- |
| selected one value       | `var-myvar=value1`                  |
| selected multiple values | `var-myvar=value1&var-myvar=value2` |
| selected `All`           | `var-myvar=All`                     |

If you want to add all of the current dashboard's variables to the URL, then use `${__all_variables}`.

## Add a data link

1. Navigate to the panel to which you want to add the data link.
1. Hover over any part of the panel to display the menu icon in the upper-right corner.
1. Click the menu icon and select **Edit** to open the panel editor.
1. In the panel edit pane, scroll down to the **Data links** section and expand it.
1. Click **Add link**.
1. In the dialog box that opens, enter a **Title**. This is a human-readable label for the link, which will be displayed in the UI.
1. Enter the **URL** or variable to which you want to link.

   To add a data link variable, click in the **URL** field and enter `$` or press Ctrl+Space or Cmd+Space to see a list of available variables.

1. If you want the link to open in a new tab, toggle the **Open in a new tab** switch.
1. Click **Save** to save changes and close the dialog box.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.

If you add multiple data links, you can control the order in which they appear in the visualization. To do this, click and drag the data link to the desired position.
