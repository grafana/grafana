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

## Enable query caching

> **Note:** The query caching feature is enabled by default. To start caching data source queries, visit the data source's configuration page.

To enable and configure query caching, please refer the the [Query caching section of Enterprise Configuration]({{< relref "./enterprise-configuration.md#caching" >}}).

Once caching is enabled in the Grafana instance, query caching can be enabled per data source in the data source settings.

## Disable query caching

To disable query caching for a single data source, visit the data source settings page.

To unilaterally disable query caching for all data sources, edit the `enabled` flag in the [Query caching section of Enterprise Configuration]({{< relref "./enterprise-configuration.md#caching" >}}).

## Sending a request without cache

If the data source query request contains an `X-Cache-Skip` header, then Grafana skips the caching middleware, and does not search the cache for a response. This can be particularly useful when debugging data source queries using cURL.
