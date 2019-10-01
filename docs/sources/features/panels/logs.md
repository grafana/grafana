+++
title = "Logs Panel"
keywords = ["grafana", "dashboard", "documentation", "panels", "logs panel"]
type = "docs"
aliases = ["/reference/logs/"]
[menu.docs]
name = "Logs"
parent = "panels"
weight = 2
+++

# Logs Panel

<img class="screenshot" src="/assets/img/features/logs-panel.png">

> Logs panel is only available in Grafana v6.4+

The logs panel shows log lines from datasources that support logs, e.g., Elastic, Influx, and Loki.
Typically you would use this panel next to a graph panel to display the log output of a related process.

## Querying Data

The logs panel will show the result of queries that are specified in the **Queries** tab.
The results of multiple queries will be merged and sorted by time.
Note that you can scroll inside the panel in case the datasource returns more lines than can be displayed at any one time.

### Query Options

To limit the number of lines rendered, you can use the queries-wide **Max data points** setting. If it is not set, the datasource will usually enforce a limit.

## Visualization Options

### Columns

1. **Time**: Show/hide the time column. This is the timestamp associated with the log line as reported from the datasource.
2. **Order**: Set to **Ascending** to show the oldest log lines first.


<div class="clearfix"></div>
