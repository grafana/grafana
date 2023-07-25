---
description: Logs in Explore
keywords:
  - explore
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Logs in Explore
weight: 15
---

# Logs in Explore

Explore is a powerful tool for logging and log analysis. It allows you to investigate logs from different data sources including:

- [Loki]({{< relref "../datasources/loki/" >}})
- [Elasticsearch]({{< relref "../datasources/elasticsearch/" >}})
- [Cloudwatch]({{< relref "../datasources/cloudwatch/" >}})
- [InfluxDB]({{< relref "../datasources/influxdb/" >}})

With Explore, you can efficiently monitor, troubleshoot, and respond to incidents by analyzing your logs and identifying the root causes. It also helps you to correlate logs with other telemetry signals such as metrics, traces or profiles, by viewing them side-by-side.

The results of log queries are displayed as individual log lines and as a graph showing the logs volume for the selected time period.

## Logs volume

When working with data sources that support a full range logs volume, Explore automatically displays a graph showing the log distribution for all the entered log queries. This feature is currently supported by Elasticsearch and Loki data sources.

> **Note:** In Loki, this full range log volume is rendered by a metric query which can be expensive depending on time range queried. This query can be particularly challenging to process for smaller Loki installations. To mitigate this, we recommend using a proxy like [nginx](https://www.nginx.com/) in front of Loki to set a custom timeout (for example, 10 seconds) for these queries. Log volume histogram queries can be identified by looking for queries with the HTTP header `X-Query-Tags` with value `Source=logvolhist`; these headers are added by Grafana to all log volume histogram queries.

If the data source does not support loading the full range logs volume, the logs model calculates a time series by counting log rows and organizing them into buckets based on an automatically calculated time interval. The timestamp of the first log row is used to anchor the start of the logs volume in the results. The end of the time series is anchored to the time picker's **To** range. This way, you can still analyze and visualize log data efficiently even when the data source doesn't offer full range support.

## Logs

In the following sections, you will find detailed explanations of how to visualize and interact with individual logs in Explore.

### Logs navigation

Logs navigation, at the right side of the log lines, can be used to easily request additional logs. You can do this by clicking the **Older logs** button at the bottom of the navigation. This is especially useful when you reach the line limit and you want to see more logs. Each request that is run from the navigation is then displayed in the navigation as separate page. Every page shows `from` and `to` timestamps of the incoming log lines. You can see previous results by clicking on each page. Explore caches the last five requests run from the logs navigation, so you're not re-running the same queries when clicking on the pages, saving time and resources.

![Navigate logs in Explore](/static/img/docs/explore/navigate-logs-8-0.png)

### Visualization options

You can customize how logs are displayed and select which columns are shown.

| Option                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time**                  | Shows or hides the time column. This is the timestamp associated with the log line as reported from the data source.                                                                                                                                                                                                                                                                                                                                                                           |
| **Unique labels**         | Shows or hides the unique labels column that includes only non-common labels. All common labels are displayed above.                                                                                                                                                                                                                                                                                                                                                                           |
| **Wrap lines**            | Set this to `true` if you want the display to use line wrapping. If set to `false`, it will result in horizontal scrolling.                                                                                                                                                                                                                                                                                                                                                                    |
| **Prettify JSON**         | Set this to `true` to pretty print all JSON logs. This setting does not affect logs in any format other than JSON.                                                                                                                                                                                                                                                                                                                                                                             |
| **Deduplication**         | Log data can be very repetitive and Explore can help by hiding duplicate log lines. There are a few different deduplication algorithms that you can use **Exact** matches are done on the whole line except for date fields. **Numbers** matches are done on the line after stripping out numbers such as durations, IP addresses, and so on. **Signature** is the most aggressive deduplication as it strips all letters and numbers and matches on the remaining whitespace and punctuation. |
| **Display results order** | You can change the order of received logs from the default descending order (newest first) to ascending order (oldest first).                                                                                                                                                                                                                                                                                                                                                                  |

### Download log lines

To download log results in either `txt` or `json` format, simply use the **Download** button. This feature allows you to save the log data for further analysis or to share it with others in a convenient and accessible format.

### Log result meta information

Above the received log lines you can find essential meta information, including:

- **Number of received logs**: Indicates the total count of logs received for the current query or time range.
- **Error**: Displays possible error in your log results
- **Common labels**: Shows common labels.
- **Total bytes processed**: Represents the cumulative size of the log data processed in bytes.

> **Note:** The availability of certain meta information may depend on the data source, and as a result, you may only see some of these details for specific data sources.

### Escaping newlines

Explore automatically detects some incorrectly escaped sequences in log lines, such as newlines (`\n`, `\r`) or tabs (`\t`). When it detects such sequences, Explore provides an "Escape newlines" option.

To automatically fix incorrectly escaped sequences that Explore has detected:

1. Click "Escape newlines" to replace the sequences.
2. Manually review the replacements to confirm their correctness.

Explore replaces these sequences. When it does so, the option will change from "Escape newlines" to "Remove escaping". Evaluate the changes as the parsing may not be accurate based on the input received. You can revert the replacements by clicking "Remove escaping".

### Log level

For the logs where a `level` label is specified, we use the value of this label to determine the log level and update color of each log line accordingly. If the log doesn't have specified level label, we try to find out if its content matches any of the supported expressions (see below for more information). The log level is always determined by the first match. In the case where Grafana is not able to infer a log level field, it will be visualized with an unknown log level.

> **Tip:** If you use a Loki data source and the "level" is part of your log line, you can use parsers (JSON, logfmt, regex,..) to extract the level information into a level label that is used to determine the level value. This will allow the histogram to show the various log levels as separate bars.

**Supported log levels and mapping of log level abbreviation and expressions:**

| Log level | Color      | Supported expressions                    |
| :-------- | :--------- | ---------------------------------------- |
| critical  | purple     | emerg, fatal, alert, crit, critical      |
| error     | red        | err, eror, error                         |
| warning   | yellow     | warn, warning                            |
| info      | green      | info, information, informational, notice |
| debug     | blue       | dbug, debug                              |
| trace     | light blue | trace                                    |
| unknown   | grey       | \*                                       |

### Highlight searched words

When your query includes specific words or expressions to search for, Explore will highlight these in the log lines for better visibility. This highlighting feature makes it easier to identify and focus on the relevant content in your logs.

> **Note:** The ability to highlight search words may vary depending on the data source. For some data sources, the highlighting of search words may not be available.

### Log details view

In Explore, each log line has an expandable section called **Log details** that can be opened by clicking on the log line. The Log details view provides additional information, including **Fields** and **Links** attached to the log lines, enabling more robust interaction and analysis.

#### Fields

Within the Log details view, you have the ability to filter displayed fields in two ways: positive filter (to show specific fields) and negative filter (to exclude certain fields). Additionally, you can select a unique field to visualize instead of the whole log line by clicking on the eye icon. Finally, each field has a stats icon to display ad-hoc statistics in relation to all displayed logs.

#### Links

Grafana offers the functionality of data links or correlations, enabling you to convert any part of a log message into an internal or external link. These links can be used to navigate to related data or external resources, providing a seamless and convenient way to explore further information.
{{< figure src="/static/img/docs/explore/data-link-9-4.png" max-width="800px" caption="Data link in Explore" >}}

### Log context

Log context is a feature that allows you to display additional lines of context surrounding a log entry that matches a particular search query. This can be helpful in understanding the log entry's context, and is similar to the `-C` parameter in the `grep` command.

You may encounter long lines of text that make it difficult to read and analyze the context around each log entry. This is where the **Wrap lines** toggle can come in handy. By enabling this toggle, Grafana will automatically wrap long lines of text so that they fit within the visible width of the viewer. This can make it easier to read and understand the log entries.

The **Open in split view** button allows you to execute the context query for a log entry in a split screen in the Explore view. Clicking this button will open a new Explore pane with the context query displayed alongside the log entry, making it easier to analyze and understand the surrounding context.

### Copy log line

You can easily copy the content of a selected log line to your clipboard by clicking on the `Copy log line` button.

### Copy link to log line

Linking of log lines in Grafana allows you to quickly navigate to specific log entries for precise analysis. By clicking the **Copy shortlink** button for a log line, you can generate and copy a [short URL]({{< relref "../developers/http_api/short_url/" >}}) that provides direct access to the exact log entry within an absolute time range. When you open the link, Grafana will automatically scroll to the corresponding log line and highlight it with a blue background, making it easy to identify and focus on the relevant information.

> **Note:** This is currently only supported in Loki and other data sources that provide an `id` field.

## Live tailing

To view real-time logs from supported data sources, you can leverage the Live tailing feature in Explore.

1. Click the **Live** button in the Explore toolbar to switch to Live tail view.
2. While in Live tail view, new logs will appear from the bottom of the screen, and they will have a fading contrasting background, allowing you to easily track what's new.
3. If you wish to pause the Live tailing and explore previous logs without any interruptions, you can do so by clicking the **Pause** button or simply scrolling through the logs view.
4. To clear the view and remove all logs from the display, click on the **Clear logs** button. This action will reset the log view and provide you with a clean slate to continue your log analysis.
5. To resume Live tailing and continue viewing real-time logs, click the **Resume** button.
6. If you want to exit Live tailing and return to the standard Explore view, click the **Stop** button.

Using the Live tailing feature, you can keep a close eye on the latest logs as they come in, making it easier to monitor real-time events and detect issues promptly.

{{< video-embed src="/static/img/docs/v95/explore_live_tailing.mp4" >}}

### Logs sample

If the selected data source implements logs sample, and supports both log and metric queries, then for metric queries you will be able to automatically see samples of log lines that contributed to visualized metrics. This feature is currently supported by Loki data sources.

### Switch from metrics to logs

If you are coming from a metrics data source that implements `DataSourceWithQueryExportSupport` (such as Prometheus) to a logging data source that supports `DataSourceWithQueryImportSupport` (such as Loki), then it will keep the labels from your query that exist in the logs and use those to query the log streams.

For example, the following Prometheus query `grafana_alerting_active_alerts{job="grafana"}` after switching to the Loki data source, will change to `{job="grafana"}`. This will return a chunk of logs in the selected time range that can be grepped/text searched.
