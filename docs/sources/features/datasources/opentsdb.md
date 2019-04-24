+++
title = "Using OpenTSDB in Grafana"
description = "Guide for using OpenTSDB in Grafana"
keywords = ["grafana", "opentsdb", "guide"]
type = "docs"
aliases = ["/datasources/opentsdb",	"docs/features/opentsdb"]
[menu.docs]
name = "OpenTSDB"
parent = "datasources"
weight = 19
+++

# Using OpenTSDB in Grafana

Grafana ships with advanced support for OpenTSDB.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select *OpenTSDB* from the *Type* dropdown.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

Name | Description
------------ | -------------
*Name* | The data source name. This is how you refer to the data source in panels & queries.
*Default* | Default data source means that it will be pre-selected for new panels.
*Url* | The http protocol, ip and port of you opentsdb server (default port is usually 4242)
*Access* | Server (default) = URL needs to be accessible from the Grafana backend/server, Browser = URL needs to be accessible from the browser.
*Version* | Version = opentsdb version, either <=2.1 or 2.2
*Resolution* | Metrics from opentsdb may have datapoints with either second or millisecond resolution.

## Query editor

Open a graph in edit mode by click the title. Query editor will differ if the datasource has version <=2.1 or = 2.2.
In the former version, only tags can be used to query OpenTSDB. But in the latter version, filters as well as tags
can be used to query opentsdb. Fill Policy is also introduced in OpenTSDB 2.2.

![](/img/docs/v43/opentsdb_query_editor.png)

> Note: While using OpenTSDB 2.2 datasource, make sure you use either Filters or Tags as they are mutually exclusive. If used together, might give you weird results.

### Auto complete suggestions

As soon as you start typing metric names, tag names and tag values , you should see highlighted auto complete suggestions for them.
The autocomplete only works if the OpenTSDB suggest api is enabled.

## Templating queries

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query variable

Grafana's OpenTSDB data source supports template variable queries. This means you can create template variables
that fetch the values from OpenTSDB. For example, metric names, tag names, or tag values.

When using OpenTSDB with a template variable of `query` type you can use following syntax for lookup.

Query | Description
------------ | -------------
*metrics(prefix)* | Returns metric names with specific prefix (can be empty)
*tag_names(cpu)* | Return tag names (i.e. keys) for a specific cpu metric
*tag_values(cpu, hostname)* | Return tag values for metric cpu and tag key hostname
*suggest_tagk(prefix)* | Return tag names (i.e. keys) for all metrics with specific prefix (can be empty)
*suggest_tagv(prefix)* | Return tag values for all metrics with specific prefix (can be empty)

If you do not see template variables being populated in `Preview of values` section, you need to enable
`tsd.core.meta.enable_realtime_ts` in the OpenTSDB server settings. Also, to populate metadata of
the existing time series data in OpenTSDB, you need to run `tsdb uid metasync` on the OpenTSDB server.

### Nested Templating

One template variable can be used to filter tag values for another template variable. First parameter is the metric name,
second parameter is the tag key for which you need to find tag values, and after that all other dependent template variables.
Some examples are mentioned below to make nested template queries work successfully.

Query | Description
------------ | -------------
*tag_values(cpu, hostname, env=$env)*  | Return tag values for cpu metric, selected env tag value and tag key hostname
*tag_values(cpu, hostname, env=$env, region=$region)* | Return tag values for cpu metric, selected env tag value, selected region tag value and tag key hostname

For details on OpenTSDB metric queries checkout the official [OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)

## Configure the Datasource with Provisioning

It's now possible to configure datasources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for datasources on the [provisioning docs page](/administration/provisioning/#datasources)

Here are some provisioning examples for this datasource.

```yaml
apiVersion: 1

datasources:
  - name: OpenTsdb
    type: opentsdb
    access: proxy
    url: http://localhost:4242
    jsonData:
      tsdbResolution: 1
      tsdbVersion: 1
```
