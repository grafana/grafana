+++
title = "What's New in Grafana v6.5"
description = "Feature & improvement highlights for Grafana v6.5"
keywords = ["grafana", "new", "documentation", "6.5"]
type = "docs"
[menu.docs]
name = "Version 6.5"
identifier = "v6.5"
parent = "whatsnew"
weight = -16
+++

# What's New in Grafana v6.5

For all details please read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

## Highlights

Grafana 6.5 comes with a lot of new features and enhancements.

- [**Docker:** Ubuntu-based images and more]({{< relref "#ubuntu-based-docker-images" >}})
- **CloudWatch:** Use GetMetricData API instead of GetMetricStatistics API
- **CloudWatch:** Dynamic queries using wildcards for dimension values
- **CloudWatch:** Deep linking from Grafana panels to the CloudWatch console
- **CloudWatch:** Improved feedback when throttling occurs
- [**Templating:** Dynamic typeahead queries using $__searchFilter]({{< relref "#dynamic-typeahead-support-in-query-variables" >}})
- [**Explore:** New log row details view]({{< relref "#explore-logs-log-row-details" >}})
- [**Explore:** Turn parts of log message into a link using derived fields]({{< relref "#loki-explore-derived-fields" >}})
- [**Explore:** Time-sync of split views]({{< relref "#time-sync-of-split-views-in-explore" >}})
- **Explore**: Tooltip in graphs
- **Azure Monitor**: Alerting support for Azure Application Insights
- **Provisioning**: Allow saving of provisioned dashboards from UI
- **Auth Proxy:** Can now login with auth proxy and get a login token and session cookie
- **OAuth:** Generic OAuth now supports role mapping

More details of above and highlights will be added as we're getting closer to the stable release.

### Ubuntu-based docker images

In Grafana [v6.4](/guides/whats-new-in-v6-4/#alpine-based-docker-image) we switched the Grafana docker image from Ubuntu to Alpine. The main reason for this change was to be able to provide a more secure and lightweight docker image.

This change has received both negative and positive feedback as well as some bug reports. Based on this, one of the conclusions and learnings is that switching to an Alpine based docker image was a big breaking change for a lot of users and this change should have been more clearly highlighted in blog post, release notes, changelog and the [Docker Hub readme](https://hub.docker.com/r/grafana/grafana).

One additional mistake we did was to break the Docker images for ARM. Good news, in Grafana v6.5 this have been fixed.

Grafana docker images should be as secure as possible by default and that’s why the Alpine based docker images will continue to be provided as Grafana’s default (`grafana/grafana:<version>`).  With that said, it’s good to give users options and that’s why starting from Grafana v6.5 there’re also Ubuntu based docker images (`grafana/grafana:<version>-ubuntu`) available.

### Dynamic typeahead support in query variables

If you have a query variable that has many thousands of values it can be quite slow to search for a specific value in the dropdown. This is due to the fact that all that search filtering is happening in the browser.

Using `__searchFilter` in the template variable query field you can filter the query results based on what the user types in the variable dropdown input.

When nothing has been entered by the user the default value for `__searchFilter` is `*` ,  `.*` or  `%`  depending on data source and formatting option.

The example below shows how to use `__searchFilter` as part of the query field to enable searching for `server` while the user types in the dropdown select box.

Query
```bash
apps.$app.servers.$__searchFilter
```

TagValues
```bash
tag_values(server, server=~${__searchFilter:regex})
```

This feature is currently only supported by [Graphite](/features/datasources/graphite/#using-searchfilter-to-filter-results-in-query-variable), [MySQL](/features/datasources/mysql/#using-searchfilter-to-filter-results-in-query-variable) and [Postgres](/features/datasources/postgres/#using-searchfilter-to-filter-results-in-query-variable) data sources.

### Explore/Logs: Log row details

We have massively simplified the way we display both log row labels/fields as well as parsed fields by putting them into an extendable area in each row.

So far labels had been squashed into their own column, making long label values difficult to read or interact with. Similarly, the parsed fields (available for logfmt and JSON structured logs) were too fiddly for mouse interaction. To solve this we took both and put them into a collapsed area below each row for more robust interaction. We have also added the ability to filter out labels, i.e., turn them into a negative filter on click (in addition to a positive filter).

### Loki/Explore: Derived fields

Derived fields allow any part of a log message to be turned into a link. Leaning on the concept of data links for graphs, we've extended the log result viewer in Explore to turn certain parsed fields into a link, based on a pattern to match.

This allows you to turn an occurrence of e.g., `traceId=624f706351956b81` in your log line, into a link to your distributed tracing system to view that trace. The configuration for the patterns to match can be found in the datasource settings.

This release starts with support for Loki, but we will bring this concept to other datasources soon.

### Time-sync of split views in Explore

In Explore's split view, the two timepickers can now be linked so that if you change one, the other gets changed as well. This helps with keeping start and end times of the split view queries in sync and will ensure that you're looking at the same time interval in both split panes.

## Upgrading

See [upgrade notes](/installation/upgrading/#upgrading-to-v6-5).

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.
