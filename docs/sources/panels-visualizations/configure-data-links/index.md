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
---

# Configure data links

Data links allow you to provide more granular context to your links. You can create links that include the series name or even the value under the cursor. For example, if your visualization shows four servers, you can add a data link to one or two of them. You can also link panels using data links.

The link itself is accessible in different ways depending on the visualization. For the time series visualization you need to click a data point or line:

![Time series visualization with a data link displayed](/media/docs/grafana/panels-visualizations/screenshot-time-series-data-link-v10.3.png)

For visualizations like stat, gauge, or bar gauge you can click anywhere on the visualization to open the context menu:

![Stat visualization with a data link displayed](/media/docs/grafana/panels-visualizations/screenshot-stat-data-link-v10.3.png)

If there's only one data link in the visualization, clicking anywhere on the visualization opens the link rather than the context menu.

## Supported visualizations

You can configure data links for the following visualizations:

|                            |                        |                                  |
| -------------------------- | ---------------------- | -------------------------------- |
| [Bar chart][bar chart]     | [Geomap][geomap]       | [State timeline][state timeline] |
| [Bar gauge][bar gauge]     | [Heatmap][heatmap]     | [Status history][status history] |
| [Candlestick][candlestick] | [Histogram][histogram] | [Table][table]                   |
| [Canvas][canvas]           | [Pie chart][pie chart] | [Time series][time series]       |
| [Gauge][gauge]             | [Stat][stat]           | [Trend][trend]                   |

## Data link variables

Variables in data links let you send people to a detailed dashboard with preserved data filters. For example, you could use variables to specify a label, time range, series, or variable selection.

To see a list of available variables, enter `$` in the data link **URL** field.

{{% admonition type="note" %}}
These variables changed in 6.4 so if you have an older version of Grafana, then use the version picker to select docs for an older version of Grafana.
{{% /admonition %}}

Azure Monitor, [CloudWatch][], and [Google Cloud Monitoring][] have pre-configured data links called _deep links_.

You can also use template variables in your data links URLs. For more information, refer to [Templates and variables][].

### Time range panel variables

These variables allow you to include the current time range in the data link URL:

| Variable           | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `__url_time_range` | Current dashboard's time range (for example, `?from=now-6h&to=now`) |
| `__from`           | For more information, refer to [Global variables][].                |
| `__to`             | For more information, refer to [Global variables][].                |

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

### Data variables

To access values and labels from other fields use:

| Variable                          | Description                                |
| --------------------------------- | ------------------------------------------ |
| `__data.fields[i]`                | Value of field `i` (on the same row)       |
| `__data.fields["NameOfField"]`    | Value of field using name instead of index |
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

1. If you want the link to open in a new tab, then toggle the **Open in a new tab** switch.
1. Click **Save** to save changes and close the dialog box.
1. Click **Apply** to see your changes in the dashboard.
1. Click the **Save dashboard** icon to save your changes to the dashboard.

## Types of value mappings

Grafana supports the following value mapping types:

### Value

A **Value** mapping maps specific values to text and a color. For example, you can configure a mapping so that all instances of the value `10` appear as **Perfection!** rather than the number. Use **Value** mapping when you want to format a single value.
![The value 10 mapped to the text Perfection!](/media/docs/grafana/panels-visualizations/screenshot-map-value-v10.4.png)

### Range

A **Range** mapping maps numerical ranges to text and a color. For example, if a value is within a certain range, you can configure a range value mapping to display **Low** or **High** rather than the number. Use **Range** mapping when you want to format multiple, continuous values.
![Ranges of numbers mapped to the text Low and High with colors yellow and red](/media/docs/grafana/panels-visualizations/screenshot-map-range-v10.4.png)

### Regex

A **Regex** mapping maps regular expressions to text and a color. For example, if a value is `www.example.com`, you can configure a regular expression value mapping so that Grafana displays **www** and truncates the domain. Use the **Regex** mapping when you want to format the text and color of a regular expression value.
![A regular expression used to truncate full URLs to the text wwww](/media/docs/grafana/panels-visualizations/screenshot-map-regex-v10.4.png)

### Special

A **Special** mapping maps special values like `Null`, `NaN` (not a number), and boolean values like `true` and `false` to text and color. For example, you can configure a special value mapping so that `null` values appear as **N/A**. Use the **Special** mapping when you want to format uncommon, boolean, or empty values.
![The value null mapped to the text N/A](/media/docs/grafana/panels-visualizations/screenshot-map-special-v10.4.png)

## Examples

Refer to the following examples to learn more about value mapping.

### Time series example

The following image shows a time series visualization with value mappings. Value mapping colors aren't applied to this visualization, but the display text is shown on the axis.

![Value mappings time series example](/static/img/docs/value-mappings/value-mappings-summary-example-8-0.png)

### Stat example

The following image shows a stat visualization with value mappings and text colors applied. You can hide the sparkline so it doesn't interfere with the values.

![Value mappings stat example](/static/img/docs/value-mappings/value-mappings-stat-example-8-0.png)

### Bar gauge example

The following image shows a bar gauge visualization with value mappings. Note that the value mapping colors are applied to the text, but not to the gauges.

![Value mappings bar gauge example](/static/img/docs/value-mappings/value-mappings-bar-gauge-example-8-0.png)

### Table example

The following image shows a table visualization with value mappings. If you want value mapping colors displayed on the table, then set the cell display mode to **Color text** or **Color background**.

![Value mappings table example](/static/img/docs/value-mappings/value-mappings-table-example-8-0.png)

## Add a value mapping

1. Navigate to the panel you want to update.
1. Hover over any part of the panel you want to work on to display the menu on the top right corner.
1. Click the menu and select **Edit**.
1. Scroll to the **Value mappings** section and expand it.
1. Click **Add value mappings**.
1. Click **Add a new mapping** and then select one of the following:

   - **Value** - Enter a single value to match.
   - **Range** - Enter the beginning and ending values of a range to match.
   - **Regex** - Enter a regular expression pattern to match.
   - **Special** - Select a special value to match.

1. (Optional) Enter display text.
1. (Optional) Set the color.
1. (Optional) Set an icon (canvas visualizations only).
1. Click **Update** to save the value mapping.

After you've added a mapping, the **Edit value mappings** button replaces the **Add value mappings** button. Click the edit button to add or update mappings.

## Docs refs

{{% docs/reference %}}
[bar chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"
[bar chart]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart"

[bar gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-gauge"
[bar gauge]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-gauge"

[candlestick]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"
[candlestick]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick"

[canvas]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/canvas"
[canvas]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/canvas"

[gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"
[gauge]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge"

[geomap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/geomap"
[geomap]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap"

[heatmap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/heatmap"
[heatmap]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/heatmap"

[histogram]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
[histogram]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram"

[pie chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/pie-chart"
[pie chart]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart"

[stat]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"
[stat]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat"

[state timeline]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[state timeline]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline"

[status history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"
[status history]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history"

[table]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"
[table]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table"

[time series]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[time series]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series"

[trend]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/trend"
[trend]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend"

[Cloudwatch]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/aws-cloudwatch/query-editor#deep-link-grafana-panels-to-the-cloudwatch-console-1"
[Cloudwatch]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/connect-externally-hosted/data-sources/aws-cloudwatch/query-editor#deep-link-grafana-panels-to-the-cloudwatch-console-1"

[Google Cloud Monitoring]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources/google-cloud-monitoring/query-editor#deep-link-from-grafana-panels-to-the-google-cloud-console-metrics-explorer"
[Google Cloud Monitoring]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/connect-externally-hosted/data-sources/google-cloud-monitoring/query-editor#deep-link-from-grafana-panels-to-the-google-cloud-console-metrics-explorer"

[Templates and variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables"
[Templates and variables]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/variables"

[Global variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#**from-and-**to"
[Global variables]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables#**from-and-**to"
{{% /docs/reference %}}
