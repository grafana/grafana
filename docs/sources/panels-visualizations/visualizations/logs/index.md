---
aliases:
  - ../../features/panels/logs/
  - ../../panels/visualizations/logs-panel/
  - ../../reference/logs/
  - ../../visualizations/logs-panel/
keywords:
  - grafana
  - dashboard
  - documentation
  - panels
  - logs panel
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's logs visualization
title: Logs
weight: 100
refs:
  supported-log-levels-and-mappings-of-log-level-abbreviation-and-expressions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#log-level
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#log-level
---

# Logs

The logs visualization shows log lines from data sources that support logs, such as Elastic, Influx, and Loki. Typically you would use this visualization next to a graph visualization to display the log output of a related process.

{{< figure src="/static/img/docs/v64/logs-panel.png" max-width="1025px" alt="Logs panel" >}}

{{< docs/play title="Logs Panel" url="https://play.grafana.org/d/6NmftOxZz/" >}}

The logs visualization shows the result of queries that were entered in the Query tab. The results of multiple queries are merged and sorted by time. You can scroll inside the panel if the data source returns more lines than can be displayed at any one time.

To limit the number of lines rendered, you can use the **Max data points** setting in the **Query options**. If it is not set, then the data source will usually enforce a default limit.

The following video provides a walkthrough of creating a logs visualization. You'll also learn how to customize some settings and log visualization caveats:

{{< youtube id="jSSi_x-fD_8" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Log level

For logs where a **level** label is specified, we use the value of the label to determine the log level and update color accordingly. If the log doesn't have a level label specified, we try to find out if its content matches any of the supported expressions (see below for more information). The log level is always determined by the first match. In case Grafana is not able to determine a log level, it will be visualized with **unknown** log level. See [supported log levels and mappings of log level abbreviation and expressions](ref:supported-log-levels-and-mappings-of-log-level-abbreviation-and-expressions).

## Log details

Each log row has an extendable area with its labels and detected fields, for more robust interaction. Each field or label has a stats icon to display ad-hoc statistics in relation to all displayed logs.

### Display options

Use these settings to refine your visualization:

- **Time -** Show or hide the time column. This is the timestamp associated with the log line as reported from the data source.
- **Unique labels -** Show or hide the unique labels column, which shows only non-common labels.
- **Common labels -** Show or hide the common labels.
- **Wrap lines -** Toggle line wrapping.
- **Prettify JSON -** Set this to `true` to pretty print all JSON logs. This setting does not affect logs in any format other than JSON.
- **Enable log details -** Toggle option to see the log details view for each log row. The default setting is true.
- **Deduplication -** Hides log messages that are duplicates of others shown according to your selected criteria. Choose from: **Exact** (ignoring ISO datetimes), **Numerical** (ignoring only those that differ by numbers such as IPs or latencies), or **Signatures** (removing successive lines with identical punctuation and white space).
- **Order -** Display results in descending or ascending time order. The default is **Descending**, showing the newest logs first. Set to **Ascending** to show the oldest log lines first.
