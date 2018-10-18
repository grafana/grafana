+++
title = "What's New in Grafana v2.5"
description = "Feature & improvement highlights for Grafana v2.5"
keywords = ["grafana", "new", "documentation", "2.5"]
type = "docs"
+++

# What's new in Grafana v2.5

## Release highlights
This is an exciting release, and we want to share some of the highlights. The release includes many
fixes and enhancements to all areas of Grafana, like new Data Sources, a new and improved timepicker, user invites, panel
resize handles and improved InfluxDB and OpenTSDB support.

### New time range controls
<img src="/img/docs/whatsnew_2_5/timepicker.png" alt="New Time picker">

A new timepicker with room for more quick ranges as well as new types of relative ranges, like `Today`,
`The day so far` and `This day last week`. Also an improved time & calendar picker that now works
correctly in UTC mode.

### Elasticsearch

<img src="/img/docs/whatsnew_2_5/elasticsearch_metrics_ex1.png" alt="Elasticsearch example">
<br>

This release brings a fully featured query editor for Elasticsearch. You will now be able to visualize
logs or any kind of data stored in Elasticsearch. The query editor allows you to build both simple
and complex queries for logs or metrics.

- Compute metrics from your documents, supported Elasticsearch aggregations:
  - Count, Avg, Min, Max, Sum
  - Percentiles, Std Dev, etc.
- Group by multiple terms or filters
  - Specify group by options like Top 5 based on Avg @value
- Auto completion for field names
- Query only relevant indices based on time pattern
- Alias patterns for short readable series names

Try the new Elasticsearch query editor on the [play.grafana.org](http://play.grafana.org/dashboard/db/elasticsearch-metrics) site.

### CloudWatch

<img src="/img/docs/whatsnew_2_5/cloudwatch.png" alt="Cloudwatch editor">

Grafana 2.5 ships with a new CloudWatch datasource that will allow you to query and visualize CloudWatch
metrics directly from Grafana.

- Rich editor with auto completion for metric names, namespaces and dimensions
- Templating queries for generic dashboards
- Alias patterns for short readable series names

### Prometheus

<img src="/img/docs/whatsnew_2_5/prometheus_editor.png" alt="Prometheus editor">

Grafana 2.5 ships with a new Prometheus datasource that will allow you to query and visualize data
stored in Prometheus.


### Mix different data sources
<img src="/img/docs/whatsnew_2_5/mixed_data.png" alt="Mix data sources in the same dashboard or in the same graph!">

In previous releases you have been able to mix different data sources on the same dashboard. In v2.5 you
will be able to mix then on the same graph! You can enable this by selecting the built in `-- Mixed --` data source.
When selected this will allow you to specify data source on a per query basis. This will, for example, allow you
to plot metrics from different Graphite servers on the same Graph or plot data from Elasticsearch alongside
data from Prometheus. Mixing different data sources on the same graph works for any data source, even custom ones.

### Panel Resize handles
<img src="/img/docs/whatsnew_2_5/panel_resize.gif" alt="">

This release adds resize handles to the the bottom right corners of panels making is easy to resize both width and height.

### User invites
<img src="/img/docs/whatsnew_2_5/org_invite.png" alt="">

This version also brings some new features for user management.

- Organization admins can now invite new users (via email or manually via invite link)
- Users can signup using invite link and get automatically added to invited organization
- User signup workflow can (if enabled) contain an email verification step.
- Check out [#2353](https://github.com/grafana/grafana/issues/2353) for more info.

### Miscellaneous improvements

- InfluxDB query editor now supports math and AS expressions
- InfluxDB query editor now supports custom group by interval
- Panel drilldown link is easier to reach
- LDAP improvements (can now search for group membership if your LDAP server does not support memberOf attribute)
- More units for graph and singlestat panel (Length, Volume, Temperature, Pressure, Currency)
- Admin page for all organizations (remove / edit)

### Breaking changes
There have been some changes to the data source plugin API. If you are using a custom plugin check that there is an update for it before you upgrade. Also
the new time picker does not currently support custom quick ranges like the last one did. This will likely be added in a
future release.

### Changelog
For a detailed list and link to github issues for everything included in the 2.5 release please
view the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file.

- - -

### <a href="https://grafana.com/get">Download Grafana 2.5 now</a>

