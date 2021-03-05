+++
title = "Query caching"
description = "Grafana Enterprise data source query caching"
keywords = ["grafana", "plugins", "query", "caching"]
weight = 110
+++

# Query caching

> **Note:** Query caching is available behind a feature flag in Grafana Enterprise 7.5+.

When query caching is enabled, Grafana will temporarily store the results of data source queries. When you or another user submit the exact same query again, the results will come back from the cache instead of from the data source (like Splunk or ServiceNow) itself. This results in faster dashboard load times, especially for popular dashboards, as well as reduced API costs and reduced likelihood that APIs will rate-limit or throttle requests.

Query caching currently works for all backend data sources. You can enable the cache globally or per data source, and you can configure the cache duration per data source. The cache is in-memory only.

## Enable query caching

To enable and configure query caching, please refer the the [Query caching section of Enterprise Configuration]({{< relref "./enterprise-configuration.md#query-caching" >}})
