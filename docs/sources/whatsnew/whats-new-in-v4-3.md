---
_build:
  list: false
aliases:
  - ../guides/whats-new-in-v4-3/
description: Feature and improvement highlights for Grafana v4.3
keywords:
  - grafana
  - new
  - documentation
  - 4.3.0
  - release notes
title: What's new in Grafana v4.3
weight: -10
---

## What's new in Grafana v4.3

Grafana v4.3 Beta is now [available for download](https://grafana.com/grafana/download/4.3.0-beta1).

## Release Highlights

- New [Heatmap Panel](http://docs.grafana.org/features/panels/heatmap/)
- Graph Panel Histogram Mode
- Elasticsearch Histogram Aggregation
- Prometheus Table data format
- New [MySQL Data Source](http://docs.grafana.org/features/datasources/mysql/) (alpha version to get some early feedback)
- 60+ small fixes and improvements, most of them contributed by our fantastic community!

Check out the [New Features in v4.3 Dashboard](https://play.grafana.org/dashboard/db/new-features-in-v4-3?orgId=1) on the Grafana Play site for a showcase of these new features.

## Histogram Support

A Histogram is a kind of bar chart that groups numbers into ranges, often called buckets or bins. Taller bars show that more data falls in that range.

The Graph Panel now supports Histograms.

![](/static/img/docs/v43/heatmap_histogram.png)

## Histogram Aggregation Support for Elasticsearch

Elasticsearch is the only supported data source that can return pre-bucketed data (data that is already grouped into ranges). With other data sources there is a risk of returning inaccurate data in a histogram due to using already aggregated data rather than raw data. This release adds support for Elasticsearch pre-bucketed data that can be visualized with the new [Heatmap Panel](http://docs.grafana.org/features/panels/heatmap/).

## Heatmap Panel

The Histogram support in the Graph Panel does not show changes over time - it aggregates all the data together for the chosen time range. To visualize a histogram over time, we have built a new [Heatmap Panel](http://docs.grafana.org/features/panels/heatmap/).

Every column in a Heatmap is a histogram snapshot. Instead of visualizing higher values with higher bars, a heatmap visualizes higher values with color. The histogram shown above is equivalent to one column in the heatmap shown below.

![](/static/img/docs/v43/heatmap_histogram_over_time.png)

The Heatmap panel also works with Elasticsearch Histogram Aggregations for more accurate server side bucketing.

![](/assets/img/blog/v4/elastic_heatmap.jpg)

## MySQL Data Source (alpha)

This release includes a [new core data source for MySQL](http://docs.grafana.org/features/datasources/mysql/). You can write any possible MySQL query and format it as either Time Series or Table Data allowing it be used with the Graph Panel, Table Panel and SingleStat Panel.

We are still working on the MySQL data source. As it's missing some important features, like templating and macros and future changes could be breaking, we are
labeling the state of the data source as Alpha. Instead of holding up the release of v4.3 we are including it in its current shape to get some early feedback. So please try it out and let us know what you think on [twitter](https://twitter.com/intent/tweet?text=.%40grafana&source=4_3_beta_blog&related=blog) or on our [community forum](https://community.grafana.com/c/releases). Is this a feature that you would use? How can we make it better?

**The query editor can show the generated and interpolated SQL that is sent to the MySQL server.**

![](/static/img/docs/v43/mysql_table_query.png)

**The query editor will also show any errors that resulted from running the query (very useful when you have a syntax error!).**

![](/static/img/docs/v43/mysql_query_error.png)

## Health Check Endpoint

Now you can monitor the monitoring with the Health Check Endpoint! The new `/api/health` endpoint returns HTTP 200 OK if everything is up and HTTP 503 Error if the Grafana database cannot be pinged.

## Lazy Load Panels

Grafana now delays loading panels until they become visible (scrolled into view). This means panels out of view are not sending requests thereby reducing the load on your time series database.

## Prometheus - Table Data (column per label)

The Prometheus data source now supports the Table Data format by automatically assigning a column to a label. This makes it really easy to browse data in the table panel.

![](/static/img/docs/v43/prom_table_cols_as_labels.png)

## Other Highlights From The Changelog

Changes:

- **Table**: Support to change column header text [#3551](https://github.com/grafana/grafana/issues/3551)
- **InfluxDB**: influxdb query builder support for ORDER BY and LIMIT (allows TOPN queries) [#6065](https://github.com/grafana/grafana/issues/6065) Support influxdb's SLIMIT Feature [#7232](https://github.com/grafana/grafana/issues/7232) thx [@thuck](https://github.com/thuck)
- **Graph**: Support auto grid min/max when using log scale [#3090](https://github.com/grafana/grafana/issues/3090), thx [@bigbenhur](https://github.com/bigbenhur)
- **Prometheus**: Make Prometheus query field a textarea [#7663](https://github.com/grafana/grafana/issues/7663), thx [@hagen1778](https://github.com/hagen1778)
- **Server**: Support listening on a Unix socket [#4030](https://github.com/grafana/grafana/issues/4030), thx [@mitjaziv](https://github.com/mitjaziv)

Fixes:

- **MySQL**: 4-byte UTF8 not supported when using MySQL database (allows Emojis in Dashboard Names) [#7958](https://github.com/grafana/grafana/issues/7958)
- **Dashboard**: Description tooltip is not fully displayed [#7970](https://github.com/grafana/grafana/issues/7970)

Lots more enhancements and fixes can be found in the [Changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Download

Head to the [v4.3 download page](https://grafana.com/grafana/download) for download links and instructions.

## Thanks

A big thanks to all the Grafana users who contribute by submitting PRs, bug reports, helping out on our [community site](https://community.grafana.com/) and providing feedback!
