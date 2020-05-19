---
title: FAQ
weight: 3
---
# FAQ

### Can I use tags?

Yes, our platform supports graphite tags as well as [meta tags](https://grafana.com/blog/2019/04/09/metrictank-meta-tags/), allowing to add extra metadata tags your series.

### Can I import my existing data?

You can import pre-existing data into the hosted platform, from either a Graphite or metrictank installation.
We either provide you with the tools and instructions, or if provided access, we offer this service for a hands-off experience.
Grafana dashboards can also be imported if you choose to use a hosted Grafana instance.

### How do I send data to the service?

See [data ingestion]({{< relref "data-ingestion" >}}).

### How does this compare to stock graphite?

The hosted platform is built on top of [metrictank](/oss/metrictank) and [graphite](/oss/graphite)
Important differences with stock Graphite to be aware of:

* support for meta tags
* the platform is optimized for append-only workloads. While historical data can be imported, and we can allow for some out-of-orderness in the recent window (e.g. last 10 or 60 points), we currently don't support out of order writes (overwriting old data)
* timeseries can change resolution (interval) over time, they will be merged automatically.
* Response metadata: performance statistics, series lineage information and rollup indicator (all visualized through grafana)
* Index pruning (hide inactive/stale series)


### My query results have a lower resolution than expected

By default, if a query tries to fetch more than 1 million datapoints, we will pick lower resolution data (rollups) for that query, to try to get the number under 1 million.
If the query, no matter which rollup we try to choose, still tries to fetch more than 20 million datapoints, we reject it.

Example:

Let's say you use the standard GrafanaCloud retention: `1s:8d,1m:60d,30m:2y`, and a query is issued for `sumSeries(<metric name pattern>)` and a time range of `24h`.
A metric with `1s` resolution has `86400` data points in a `24h` period, so if `<metric name pattern>` matches `12` or more metrics then `12*86400=1036800` which exceeds the threshold,
so we will pick the minutely data instead. This way you typically still get high enough resolution (in this case 1440 points per serie), but higher query performance.

Note that on custom plans, these settings can be adjusted. You can also [pre-aggregate data in carbon-relay-ng](https://github.com/grafana/carbon-relay-ng/blob/master/docs/aggregation.md) to load fewer series.

## Do I have to use hosted grafana or exclusively the hosted platform?

No, the hosted platform is a datasource that you can use however you like. E.g. in combination with other datasources, and queried from any Grafana instance or other client.
