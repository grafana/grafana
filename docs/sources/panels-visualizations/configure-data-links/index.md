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
menuTitle: Configure data links and actions
title: Configure data links and actions
description: Configure data links to create links between dashboards and link to external resources
weight: 80
refs:
  api-settings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/#button-api-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/latest/panels-visualizations/visualizations/canvas/#button-api-options
  global-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#__from-and-__to
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#__from-and-__to
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

# Configure data links and actions

_Data links_ allow you to link to other panels, dashboards, and external resources and _actions_ let you trigger basic, unauthenticated, API calls.
In both cases, you can carry out these tasks while maintaining the context of the source panel.

## Data links

With data links, you can create links that include the series name or even the value under the cursor. For example, if your visualization shows four servers, you can add a data link to one or two of them.

The link itself is accessible in different ways depending on the visualization. For the time series visualization you need to click a data point or line:

![Time series visualization with a data link displayed](/media/docs/grafana/panels-visualizations/screenshot-time-series-data-link-v10.3.png)

For visualizations like stat, gauge, or bar gauge you can click anywhere on the visualization to open the context menu:

![Stat visualization with a data link displayed](/media/docs/grafana/panels-visualizations/screenshot-stat-data-link-v10.3.png)

If there's only one data link in the visualization, clicking anywhere on the visualization opens the link rather than the context menu.

### Supported visualizations

You can configure data links for the following visualizations:

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

## Actions

Using actions, you can trigger processes like starting or shutting down a server, directly from a dashboard panel. [API settings](ref:api-settings) are configured in the **Add action** dialog box. You can also pass variables in the API editor.

### Supported visualizations

You can configure actions for the following visualizations:

{{< column-list >}}

- [Bar chart](ref:bar-chart)
- [Candlestick](ref:candlestick)
- [State timeline](ref:state-timeline)
- [Status history](ref:status-history)
- [Table](ref:table)
- [Time series](ref:time-series)
- [Trend](ref:trend)
- [XY chart](ref:xy-chart)

{{< /column-list >}}

## Data link and action variables {#data-link-variables}

Variables in data links and actions let you send people to a detailed dashboard or trigger an API call with preserved data filters. For example, you could use variables to specify a label, time range, series, or variable selection.

To see a list of available variables, enter `$` in the data link or action **URL** field.

{{< admonition type="note" >}}
These variables changed in 6.4 so if you have an older version of Grafana, then use the version picker to select docs for an older version of Grafana.
{{< /admonition >}}

Azure Monitor, [CloudWatch](ref:cloudwatch), and [Google Cloud Monitoring](ref:google-cloud-monitoring) have pre-configured data links called _deep links_.

You can also use template variables in your data links or actions URLs. For more information, refer to [Templates and variables](ref:templates-and-variables).

### Time range panel variables

These variables allow you to include the current time range in the data link or action URL:

| Variable           | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `__url_time_range` | Current dashboard's time range (for example, `?from=now-6h&to=now`)      |
| `__from`           | For more information, refer to [Global variables](ref:global-variables). |
| `__to`             | For more information, refer to [Global variables](ref:global-variables). |

When you create data links and actions using time range variables like `__url_time_range` in the URL, you have to form the query parameter syntax yourself; that is, you must format the URL by appending query parameters using the question mark (`?`) and ampersand (`&`) syntax. These characters aren't automatically generated.

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

Using value-specific variables in data links and actions can show different results depending on the set option of Tooltip mode.

When you create data links and actions using time range variables like `__value.time` in the URL, you have to form the query parameter syntax yourself; that is, you must add the question mark (`?`) and ampersand (`&`). These characters aren't automatically generated.

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

#### Variable names and labels

If you're using a data link to link to another dashboard, always use the _variable name_, not the label.  
Labels are only used as display text and aren't recognized in URLs.

For example, if you have a variable with the name `var-server` and the label `ChooseYourServer`, you must use `var-server` in the URL, as shown in the following table:

| Correct link                                   | Incorrect link                                           |
| ---------------------------------------------- | -------------------------------------------------------- |
| `/d/xxxx/dashboard-b?orgId=1&var-server=web02` | `/d/xxxx/dashboard-b?orgId=1&var-ChooseYourServer=web02` |

{{< admonition type="note">}}
If two dashboards use different variable names (for example, `server` in one and `host` in another), you must either align them or explicitly map values (for example, `&var-host=${server}`).
{{< /admonition >}}

## Add data links or actions {#add-a-data-link}

The following tasks describe how to configure data links and actions.

{{< tabs >}}
{{< tab-content name="Add data links" >}}
To add a data link, follow these steps:

1. Navigate to the panel to which you want to add the data link.
1. Hover over any part of the panel to display the menu icon in the upper-right corner.
1. Click the menu icon and select **Edit** to open the panel editor.
1. Scroll down to the **Data links and actions** section and expand it.
1. Click **+ Add link**.
1. In the dialog box that opens, enter a **Title**.

   This is a human-readable label for the link displayed in the UI. This is a required field.

1. Enter the **URL** to which you want to link.
1. (Optional) To add a data link variable, do the following:

   - Click in the **URL** field and enter `$` or press Ctrl+Space or Cmd+Space to see a list of available variables.
   - Ensure that you use the variable _name_ and not the variable _label_ in the URL. The label is only used as display text.

1. If you want the link to open in a new tab, toggle the **Open in a new tab** switch.
1. If you want the data link to open with a single click on the visualization, toggle the **One click** switch.

   Only one data link can have **One click** enabled at a time. **One click** is only supported for some visualizations.

1. Click **Save** to save changes and close the dialog box.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.

   {{< /tab-content >}}
   {{< tab-content name="Add actions" >}}

   {{< admonition type="note">}}
   Actions are not supported for all visualizations. For the list of supported visualizations, refer to [Supported visualizations](#supported-visualizations-1).
   {{< /admonition >}}

   To add an action, by follow these steps:

1. Navigate to the panel to which you want to add the action.
1. Hover over any part of the panel to display the menu icon in the upper-right corner.
1. Click the menu icon and select **Edit** to open the panel editor.
1. Scroll down to the **Data links and actions** section and expand it.
1. Click **+ Add action**.
1. In the dialog box that opens, define the API call settings:

   | Option               | Description                                                                                                                                                                                                                                 |
   | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Title                | A human-readable label for the action that's displayed in the UI.                                                                                                                                                                           |
   | Confirmation message | A descriptive prompt to confirm or cancel the action.                                                                                                                                                                                       |
   | Method               | Select from **POST**, **PUT**, or **GET**.                                                                                                                                                                                                  |
   | URL                  | The request URL.</p><p>To add a variable, click in the **URL** field and enter `$` or press Ctrl+Space or Cmd+Space to see a list of available variables.                                                                                   |
   | Variables            | **Key** and **Name** pairs with a type selection. Click the **+** icon to add as many variables as you need. To add a variable to the request, prefix the key with `$`. You can set the values for the variables when performing an action. |
   | Query parameters     | **Key** and **Value** pairs. Click the **+** icon to add as many key/value pairs as you need.                                                                                                                                               |
   | Headers              | Comprised of **Key** and **Value** pairs and a **Content-Type**.</p><p>Click the **+** icon to add as many key/value pairs as you need.                                                                                                     |
   | Content-Type         | Select from the following: **application/json**, **text/plain**, **application/XML**, and **application/x-www-form-urlencoded**.                                                                                                            |
   | Body                 | The body of the request.                                                                                                                                                                                                                    |

1. Click **Save** to save changes and close the dialog box.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.
   {{< /tab-content >}}
   {{< /tabs >}}

If you add multiple data links or actions, you can control the order in which they appear in the visualization. To do this, click and drag the data link or action to the desired position.
