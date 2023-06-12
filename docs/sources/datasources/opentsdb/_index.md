---
aliases:
  - ../data-sources/opentsdb/
  - ../features/datasources/opentsdb/
  - ../features/opentsdb/
description: Guide for using OpenTSDB in Grafana
keywords:
  - grafana
  - opentsdb
  - guide
menuTitle: OpenTSDB
title: OpenTSDB data source
weight: 1100
---

# OpenTSDB data source

Grafana ships with advanced support for OpenTSDB.
This topic explains configuration, variables, querying, and other features specific to the OpenTSDB data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

## OpenTSDB settings

To configure basic settings for the data source, complete the following steps:

1.  Click **Connections** in the left-side menu.
1.  Under Your connections, click **Data sources**.
1.  Enter `OpenTSDB` in the search bar.
1.  Select **OpenTSDB**.

    The **Settings** tab of the data source is displayed.

1.  Set the data source's basic configuration options:

| Name                | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Name**            | The data source name. This is how you refer to the data source in panels and queries.    |
| **Default**         | Default data source that will be be pre-selected for new panels.                         |
| **URL**             | The HTTP protocol, IP, and port of your OpenTSDB server (default port is usually 4242).  |
| **Allowed cookies** | Listing of cookies to forward to the data source.                                        |
| **Version**         | The OpenTSDB version.                                                                    |
| **Resolution**      | Metrics from OpenTSDB may have data points with either second or millisecond resolution. |
| **Lookup limit**    | Default is 1000.                                                                         |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

#### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: OpenTSDB
    type: opentsdb
    access: proxy
    url: http://localhost:4242
    jsonData:
      tsdbResolution: 1
      tsdbVersion: 1
```

## Query editor

Open a graph in edit mode by click the title. Query editor will differ if the data source has version <=2.1 or = 2.2.
In the former version, only tags can be used to query OpenTSDB. But in the latter version, filters as well as tags
can be used to query OpenTSDB. Fill Policy is also introduced in OpenTSDB 2.2.

![](/static/img/docs/v43/opentsdb_query_editor.png)

{{% admonition type="note" %}}
While using OpenTSDB 2.2 data source, make sure you use either Filters or Tags as they are mutually exclusive. If used together, might give you weird results.
{{% /admonition %}}

### Auto complete suggestions

As soon as you start typing metric names, tag names and tag values , you should see highlighted auto complete suggestions for them.
The autocomplete only works if the OpenTSDB suggest API is enabled.

## Templating queries

Instead of hard-coding things like server, application and sensor name in your metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the data
being displayed in your dashboard.

Check out the [Templating]({{< relref "../../dashboards/variables/" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query variable

Grafana's OpenTSDB data source supports template variable queries. This means you can create template variables
that fetch the values from OpenTSDB. For example, metric names, tag names, or tag values.

When using OpenTSDB with a template variable of `query` type you can use following syntax for lookup.

| Query                       | Description                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| `metrics(prefix)`           | Returns metric names with specific prefix (can be empty)                          |
| `tag_names(cpu)`            | Returns tag names (i.e. keys) for a specific cpu metric                           |
| `tag_values(cpu, hostname)` | Returns tag values for metric cpu and tag key hostname                            |
| `suggest_tagk(prefix)`      | Returns tag names (i.e. keys) for all metrics with specific prefix (can be empty) |
| `suggest_tagv(prefix)`      | Returns tag values for all metrics with specific prefix (can be empty)            |

If you do not see template variables being populated in `Preview of values` section, you need to enable
`tsd.core.meta.enable_realtime_ts` in the OpenTSDB server settings. Also, to populate metadata of
the existing time series data in OpenTSDB, you need to run `tsdb uid metasync` on the OpenTSDB server.

### Nested templating

One template variable can be used to filter tag values for another template variable. First parameter is the metric name,
second parameter is the tag key for which you need to find tag values, and after that all other dependent template variables.
Some examples are mentioned below to make nested template queries work successfully.

| Query                                                 | Description                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tag_values(cpu, hostname, env=$env)`                 | Return tag values for cpu metric, selected env tag value and tag key hostname                            |
| `tag_values(cpu, hostname, env=$env, region=$region)` | Return tag values for cpu metric, selected env tag value, selected region tag value and tag key hostname |

For details on OpenTSDB metric queries, check out the official [OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)
