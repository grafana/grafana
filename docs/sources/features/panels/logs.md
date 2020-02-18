+++
title = "Logs Panel"
keywords = ["grafana", "dashboard", "documentation", "panels", "logs panel"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/logs/"]
[menu.docs]
name = "Logs"
parent = "panels"
weight = 4
+++

# Logs Panel

<img class="screenshot" src="/img/docs/v64/logs-panel.png">

> Logs panel is only available in Grafana v6.4+

The logs panel shows log lines from datasources that support logs, e.g., Elastic, Influx, and Loki.
Typically you would use this panel next to a graph panel to display the log output of a related process.

## Querying Data

The logs panel will show the result of queries that are specified in the **Queries** tab.
The results of multiple queries will be merged and sorted by time.
Note that you can scroll inside the panel in case the datasource returns more lines than can be displayed at any one time.

### Query Options

To limit the number of lines rendered, you can use the queries-wide **Max data points** setting. If it is not set, the datasource will usually enforce a limit.

## Visualization options

1. **Time**: Show/hide the time column. This is the timestamp associated with the log line as reported from the data source.
2. **Order**: Set to **Ascending** to show the oldest log lines first.
3. **Wrap lines**: The wrapped-line option is set as a default, unwrapped setting results in horizontal scrolling.
4. **Unique labels**: Show/hide the unique labels column which includes only non-common labels.

<div class="clearfix"></div>
