+++
title = "Query caching"
description = "Grafana Enterprise data source query caching"
keywords = ["grafana", "plugins", "query", "caching"]
weight = 110
+++

# Query caching

When query caching is enabled, Grafana temporarily stores the results of data source queries. When you or another user submit the exact same query again, the results will come back from the cache instead of from the data source (like Splunk or ServiceNow) itself.

Query caching works for all backend data sources, and queries sent through the data source proxy. You can enable the cache globally and configure the cache duration (also called Time to Live, or TTL).

The following cache backends are available: in-memory, Redis, and Memcached.

> **Note:** Storing cached queries in-memory can increase Grafana's memory footprint. In production environments, a Redis or Memcached backend is highly recommended.

## Query caching benefits

- Faster dashboard load times, especially for popular dashboards.
- Reduced API costs.
- Reduced likelihood that APIs will rate-limit or throttle requests.

## Enable and configure query caching

By default, data source queries are not cached. To enable query caching for a single data source:
1. On the side menu, click Configuration > Data Sources.
1. In the data source list, click the data source that you want to turn on caching for.
1. In the Cache tab, click Enable.
1. Open the Cache tab.
1. Press the Enable button. 
1. (Optional) Choose a custom TTL for that data source. If you skip this step, then Grafana uses the default TTL.

> **Note:** If query caching is enabled and the Cache tab is not visible in a data source's settings, then query caching is not available for that data source.

To configure global settings for query caching, refer the the [Query caching section of Enterprise Configuration]({{< relref "./enterprise-configuration.md#caching" >}}).

## Disable query caching

To disable query caching for a single data source: 
1. On the side menu, click Configuration > Data Sources.
1. In the data source list, click the data source that you want to turn off caching for.
1. In the Cache tab, click Disable.

To disable query caching for an entire Grafana instance, set the `enabled` flag to `false` in the [Query caching section of Enterprise Configuration]({{< relref "./enterprise-configuration.md#caching" >}}). You will no longer see the Cache tab on any data sources and no data source queries will be cached.

## Sending a request without cache

If a data source query request contains an `X-Cache-Skip` header, then Grafana skips the caching middleware, and does not search the cache for a response. This can be particularly useful when debugging data source queries using cURL.
