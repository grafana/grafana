---
description: Grafana Enterprise data source query caching
keywords:
- grafana
- plugins
- query
- caching
title: Query caching
weight: 110
---

# Query caching

> **Note:** Query caching is available behind the `caching` feature flag in Grafana Enterprise 7.5+.

When query caching is enabled, Grafana temporarily stores the results of data source queries. When you or another user submit the exact same query again, the results will come back from the cache instead of from the data source (like Splunk or ServiceNow) itself.

Query caching currently works for all backend data sources. You can enable the cache globally and configure the cache duration (also called Time to Live, or TTL). The cache can either be in-memory or in Redis.

## Query caching benefits

- Faster dashboard load times, especially for popular dashboards.
- Reduced API costs.
- Reduced likelihood that APIs will rate-limit or throttle requests.

## Enable query caching

To enable and configure query caching, please refer the the [Query caching section of Enterprise Configuration]({{< relref "./enterprise-configuration.md#caching" >}}).

## Sending a request without cache

If the data source query request contains an `X-Cache-Skip` header, then Grafana skips the caching middleware, and does not search the cache for a response. This can be particularly useful when debugging data source queries using cURL.
