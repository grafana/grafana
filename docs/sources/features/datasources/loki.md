+++
title = "Using Loki in Grafana"
description = "Guide for using Loki in Grafana"
keywords = ["grafana", "loki", "logging", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/loki"]
[menu.docs]
name = "Loki"
parent = "datasources"
weight = 6
+++

# Using Loki in Grafana

> BETA: Querying Loki data requires Grafana's Explore section.
> Grafana v6.x comes with Explore enabled by default.
> In Grafana v5.3.x and v5.4.x. you need to enable Explore manually.
> Viewing Loki data in dashboard panels is supported in Grafana v6.4+.

Grafana ships with built-in support for Loki, Grafana's log aggregation system.
Just add it as a data source and you are ready to query your log data in [Explore]({{< relref "../explore" >}}).

## Adding the data source

1. Open Grafana and make sure you are logged in.
2. In the side menu under the `Configuration` link you should find a link named `Data Sources`.
3. Click the `Add data source` button at the top.
4. Select `Loki` from the list of data sources.

> Note: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

| Name            | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_          | The data source name. This is how you refer to the data source in panels, queries, and Explore.                                                 |
| _Default_       | Default data source means that it will be pre-selected for new panels.                                                                         |
| _URL_           | The URL of the Loki instance, e.g., `http://localhost:3100`                                                                                   |
| _Maximum lines_ | Upper limit for number of log lines returned by Loki (default is 1000). Decrease if your browser is sluggish when displaying logs in Explore. |

### Derived fields

The Derived Fields configuration allows you to: 
* Add fields parsed from the log message. 
* Add a link that uses the value of the field. 

You can use this functionality to link to your tracing backend directly from your logs, or link to a user profile page if a userId is present in the log line. These links will be shown in the [log details](/features/explore/#labels-and-parsed-fields).
{{< docs-imagebox img="/img/docs/v65/loki_derived_fields.png" class="docs-image--no-shadow" caption="Screenshot of the derived fields configuration" >}}
Each derived field consists of:
- **Name:** Shown in the log details as a label.
- **Regex:** A Regex pattern that runs on the log message and captures part of it to as the value of the new field. Can only contain capture a single group.
- **URL**: A URL template used to construct a link next to the field value in log details. Use special `${__value.raw}` value in your template to interpolate the real field value into your URL template.

You can use a debug section to see what your fields extract and how the URL is interpolated. Click **Show example log message** to show the text area where you can enter a log message.
{{< docs-imagebox img="/img/docs/v65/loki_derived_fields_debug.png" class="docs-image--no-shadow" caption="Screenshot of the derived fields debugging" >}}

The new field with the link shown in log details:
{{< docs-imagebox img="/img/docs/v65/loki_derived_fields_detail.png" class="docs-image--no-shadow" caption="Screenshot of the derived field in log detail" >}}

## Querying Logs

Querying and displaying log data from Loki is available via [Explore]({{< relref "../explore" >}}), and with the [logs panel]({{< relref "../panels/logs/" >}}) in dashboards. Select the Loki data source, and then enter a log query to display your logs.

### Log Queries

A log query consists of two parts: **log stream selector**, and a **search expression**. For performance reasons you need to start by choosing a log stream by selecting a log label.

The Logs Explorer (the `Log labels` button) next to the query field shows a list of labels of available log streams. An alternative way to write a query is to use the query field's autocomplete - you start by typing a left curly brace `{` and the autocomplete menu will suggest a list of labels. Press the `enter` key to execute the query.

Once the result is returned, the log panel shows a list of log rows and a bar chart where the x-axis shows the time and the y-axis shows the frequency/count.

<div class="medium-6 columns">
  <video width="800" height="500" controls>
    <source src="https://grafana.com/static/assets/videos/explore_loki.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>

<br />

### Log Stream Selector

For the label part of the query expression, wrap it in curly braces `{}` and then use the key value syntax for selecting labels. Multiple label expressions are separated by a comma:

`{app="mysql",name="mysql-backup"}`

The following label matching operators are currently supported:

* `=` exactly equal.
* `!=` not equal.
* `=~` regex-match.
* `!~` do not regex-match.

Examples:

* `{name=~"mysql.+"}`
* `{name!~"mysql.+"}`

The [same rules that apply for Prometheus Label Selectors](https://prometheus.io/docs/prometheus/latest/querying/basics/#instant-vector-selectors) apply for Loki Log Stream Selectors.

Another way to add a label selector, is in the table section, clicking on the **Filter** button beside a label will add the label to the query expression. This even works for multiple queries and will the label selector to each query.

### Search Expression

After writing the Log Stream Selector, you can filter the results further by writing a search expression. The search expression can be just text or a regex expression.

Example queries:

* `{job="mysql"} |= "error"`
* `{name="kafka"} |~ "tsdb-ops.*io:2003"`
* `{instance=~"kafka-[23]",name="kafka"} != "kafka.server:type=ReplicaManager"`

Filter operators can be chained and will sequentially filter down the expression. The resulting log lines will satisfy every filter.

**Example**

`{job="mysql"} |= "error" != "timeout"`

The following filter types are currently supported:

* `|=` line contains string.
* `!=` line doesn't contain string.
* `|~` line matches regular expression.
* `!~` line does not match regular expression.

> Note: For more details about LogQL, Loki's query language, refer to the [documentation](https://github.com/grafana/loki/blob/master/docs/logql.md)

## Live tailing

Loki supports Live tailing which displays logs in real-time. This feature is supported in [Explore]({{< relref "../explore/#loki-specific-features" >}}).

Note that Live Tailing relies on two Websocket connections: one between the browser and the Grafana server, and another between the Grafana server and the Loki server. If you run any reverse proxies, please configure them accordingly.


> Note: This feature is only available in Grafana v6.3+

## Log Context

When using a search expression as detailed above, you now have the ability to retrieve the context surrounding your filtered results.
By clicking the `Show Context` link on the filtered rows, you'll be able to investigate the log messages that came before and after the
log message you're interested in.

> Note: This feature is only available in Grafana v6.3+

## Templating

Instead of hard-coding things like server, application and sensor name in your metric queries, you can use variables in their place. Variables are shown as drop-down select boxes at the top of the dashboard. These drop-down boxes make it easy to change the data being displayed in your dashboard.

Check out the [Templating]({{< relref "../../reference/templating" >}}) documentation for an introduction to the templating feature and the different types of template variables.

## Annotations

You can use any non-metric Loki query as a source for annotations. Log content will be used as annotation text and your log stream labels as tags, so there is no need for additional mapping.

> Note: Annotations for Loki are only available in Grafana v6.4+

## Configure the data source with provisioning

You can set up the data source via config files with Grafana's provisioning system.
You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here is an example:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    jsonData:
      maxLines: 1000
```

Here's another with basic auth and derived field. Keep in mind that `$` character needs to be escaped in yaml values as it is used to interpolate environment variables:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    basicAuth: true
    basicAuthUser: my_user
    basicAuthPassword: test_password
    jsonData:
      maxLines: 1000
      derivedFields:
        - datasourceName: Jaeger
          matcherRegex: "traceID=(\\w+)"
          name: TraceID
          url: "http://localhost:16686/trace/$${__value.raw}"
```
