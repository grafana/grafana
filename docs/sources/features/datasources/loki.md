+++
title = "Using Loki in Grafana"
description = "Guide for using Loki in Grafana"
keywords = ["grafana", "loki", "logging", "guide"]
type = "docs"
aliases = ["/datasources/loki"]
[menu.docs]
name = "Loki"
parent = "datasources"
weight = 6
+++

# Using Loki in Grafana

> BETA: Querying Loki data requires Grafana's Explore section.
> Grafana v6.x comes with Explore enabled by default.
> In Grafana v5.3.x and v5.4.x. you need to enable Explore manually.
> Viewing Loki data in dashboard panels is not supported yet, but is being worked on.

Grafana ships with built-in support for Loki, Grafana's log aggregation system.
Just add it as a datasource and you are ready to query your log data in [Explore](/features/explore).

## Adding the data source to Grafana

1. Open Grafana and make sure you are logged in.
2. In the side menu under the `Configuration` link you should find a link named `Data Sources`.
3. Click the `Add data source` button at the top.
4. Select `Loki` from the list of data sources.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

| Name            | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_          | The datasource name. This is how you refer to the datasource in panels, queries, and Explore.                                                 |
| _Default_       | Default datasource means that it will be pre-selected for new panels.                                                                         |
| _URL_           | The URL of the Loki instance, e.g., `http://localhost:3100`                                                                                   |
| _Maximum lines_ | Upper limit for number of log lines returned by Loki (default is 1000). Decrease if your browser is sluggish when displaying logs in Explore. |

## Querying Logs

Querying and displaying log data from Loki is available via [Explore](/features/explore).
Select the Loki data source, and then enter a log query to display your logs.

> Viewing Loki data in dashboard panels is not supported yet, but is being worked on.

### Log Queries

A log query consists of two parts: **log stream selector**, and a **search expression**. For performance reasons you need to start by choosing a log stream by selecting a log label.

The Logs Explorer (the `Log labels` button) next to the query field shows a list of labels of available log streams. An alternative way to write a query is to use the query field's autocomplete - you start by typing a left curly brace `{` and the autocomplete menu will suggest a list of labels. Press the `enter` key to execute the query.

Once the result is returned, the log panel shows a list of log rows and a bar chart where the x-axis shows the time and the y-axis shows the frequency/count.

<div class="medium-6 columns">
  <video width="800" height="500" controls>
    <source src="/assets/videos/explore_loki.mp4" type="video/mp4">
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

* `{job="mysql"} error`
* `{name="kafka"} tsdb-ops.*io:2003`
* `{instance=~"kafka-[23]",name="kafka"} kafka.server:type=ReplicaManager`

## Templating

Template variables are not yet supported by Loki.

## Annotations

Annotations are not yet supported by Loki.

## Configure the Datasource with Provisioning

You can set up the datasource via config files with Grafana's provisioning system.
You can read more about how it works and all the settings you can set for datasources on the [provisioning docs page](/administration/provisioning/#datasources)

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

Here's another with basic auth:

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
```
