---
aliases:
  - ../features/panels/logs/
  - ../panels/visualizations/logs-panel/
  - ../reference/logs/
keywords:
  - grafana
  - dashboard
  - documentation
  - panels
  - logs panel
title: Logs panel
weight: 700
---

# Logs panel

The logs panel visualization shows log lines from data sources that support logs, such as Elastic, Influx, and Loki. Typically you would use this panel next to a graph panel to display the log output of a related process.

<img class="screenshot" src="/static/img/docs/v64/logs-panel.png">

The logs panel shows the result of queries that were entered in the Query tab. The results of multiple queries are merged and sorted by time. You can scroll inside the panel if the data source returns more lines than can be displayed at any one time.

To limit the number of lines rendered, you can use the **Max data points** setting in the **Query options**. If it is not set, then the data source will usually enforce a default limit.

## Log level

For logs where a **level** label is specified, we use the value of the label to determine the log level and update color accordingly. If the log doesn't have a level label specified, we try to find out if its content matches any of the supported expressions (see below for more information). The log level is always determined by the first match. In case Grafana is not able to determine a log level, it will be visualized with **unknown** log level. See [supported log levels and mappings of log level abbreviation and expressions]({{< relref "../explore/_index.md#log-level" >}}).

## Log details

Each log row has an extendable area with its labels and detected fields, for more robust interaction. Each field or label has a stats icon to display ad-hoc statistics in relation to all displayed logs.

### Derived fields links

By using Derived fields, you can turn any part of a log message into an internal or external link. The created link is visible as a button next to the Detected field in the Log details view.

### Display options

Use these settings to refine your visualization:

- **Time -** Show or hide the time column. This is the timestamp associated with the log line as reported from the data source.
- **Unique labels -** Show or hide the unique labels column, which shows only non-common labels.
- **Common labels -** Show or hide the common labels.
- **Wrap lines -** Toggle line wrapping.
- **Prettify JSON -** Set this to `true` to pretty print all JSON logs. This setting does not affect logs in any format other than JSON.
- **Enable log details -** Toggle option to see the log details view for each log row. The default setting is true.
- **Order -** Display results in descending or ascending time order. The default is **Descending**, showing the newest logs first. Set to **Ascending** to show the oldest log lines first.
