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
- [**CloudWatch:** Major rewrite and lots of enhancements]({{< relref "#cloudwatch-data-source-improvements" >}})
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

Grafana docker images should be as secure as possible by default and that’s why the Alpine based docker images will continue to be provided as Grafana’s default (`grafana/grafana:<version>`). With that said, it’s good to give users options and that’s why starting from Grafana v6.5 there’re also Ubuntu based docker images (`grafana/grafana:<version>-ubuntu`) available.

### CloudWatch data source improvements

In this release, several feature improvements and additions were made in the CloudWatch data source. This work has been done in collaboration with the Amazon CloudWatch team.

#### GetMetricData API

For Grafana version 6.5 or higher, all API requests to GetMetricStatistics have been replaced with calls to GetMetricData, following Amazon’s [best practice to use the GetMetricData API](https://aws.amazon.com/premiumsupport/knowledge-center/cloudwatch-getmetricdata-api) instead of GetMetricStatistics, because data can be retrieved faster at scale with GetMetricData. This change provides better support for CloudWatch metric math and enables the use of automatic search expressions.

While GetMetricStatistics qualified for the CloudWatch API free tier, this is not the case for GetMetricData calls. For more information, please refer to the [CloudWatch pricing page](https://aws.amazon.com/cloudwatch/pricing/).

#### Dynamic queries using dimension wildcards

In Grafana 6.5 or higher, you’re able to monitor a dynamic list of metrics by using the asterisk (\*) wildcard for one or more dimension values.

{{< docs-imagebox img="/img/docs/v65/cloudwatch-dimension-wildcard.png" max-width="800px" class="docs-image--right" caption="CloudWatch dimension wildcard" >}}

In the example, all metrics in the namespace `AWS/EC2` with a metric name of `CPUUtilization` and ANY value for the `InstanceId` dimension are queried. This can help you monitor metrics for AWS resources, like EC2 instances or containers. For example, when new instances get created as part of an auto scaling event, they will automatically appear in the graph without you having to track the new instance IDs. You can click on `Show Query Preview` to see the search expression that is automatically built to support wildcards. To learn more about search expressions, visit the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html).

By default, the search expression is defined in such a way that the queried metrics must match the defined dimension names exactly. This means that in the example below only metrics with exactly one dimension with name ‘InstanceId’ will be returned.

You can untoggle `Match Exact` to include metrics that have other dimensions defined. Disabling ‘Match Exact’ also creates a search expression even if you don’t use wildcards. We simply search for any metric that match at least the namespace, metric name, and all defined dimensions.

#### Deep linking from Grafana panels to the CloudWatch console

{{< docs-imagebox img="/img/docs/v65/cloudwatch-deep-linking.png" max-width="500px" class="docs-image--right" caption="CloudWatch deep linking" >}}

Left clicking a time series in the panel shows a context menu with a link to `View in CloudWatch console`. Clicking that link will open a new tab that will take you to the CloudWatch console and display all the metrics for that query. If you are not currently logged in to the CloudWatch console, the link will forward you to the login page. The provided link is valid for any account but will only display the right metrics if you are logged in to the account that corresponds to the selected data source in Grafana.

This feature is not available for metrics that are based on math expressions.

#### Improved feedback when throttling occurs

If the [limit of the GetMetricData API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html) is reached (either the transactions per second limit or the data points per second limit), a throttling error will be returned by the CloudWatch API. Throttling limits are defined per account and region, so the alert modal will indicate which data source got throttled in which region. A link to request a limit increase will be provided for the affected region, but you will have to log in to the correct account. For example, for us-east-1, a limit increase can be requested [here](https://console.aws.amazon.com/servicequotas/home?region=us-east-1#!/services/monitoring/quotas/L-5E141212).

#### Multi-value template variables now use search expressions

When defining dimension values based on multi-valued template variables, we now use search expressions to query for the matching metrics. This enables the use of multiple template variables in one query and also allows you to use template variables for queries that have the `Match Exact` option disabled.

Search expressions are currently limited to 1024 characters, so your query may fail if you have a long list of values. We recommend using the asterisk (\*) wildcard instead of the `All` option if you want to query all metrics that have any value for a certain dimension name.

The use of multi-valued template variables is only supported for dimension values. Using multi-valued template variables for `Region`, `Namespace`, or `Metric Name` is not supported.

### Dynamic typeahead support in query variables

If you have a query variable that has many thousands of values it can be quite slow to search for a specific value in the dropdown. This is due to the fact that all that search filtering is happening in the browser.

Using `__searchFilter` in the template variable query field you can filter the query results based on what the user types in the variable dropdown input. When nothing has been entered by the user the default value for `__searchFilter` is `*` , `.*` or `%` depending on data source and formatting option.

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

{{< docs-imagebox img="/img/docs/v65/explore_log_details.gif" caption="Explore Log row details" >}}

### Loki/Explore: Derived fields

Derived fields allow any part of a log message to be turned into a link. Leaning on the concept of data links for graphs, we've extended the log result viewer in Explore to turn certain parsed fields into a link, based on a pattern to match.

This allows you to turn an occurrence of e.g., `traceId=624f706351956b81` in your log line, into a link to your distributed tracing system to view that trace. The configuration for the patterns to match can be found in the datasource settings.

This release starts with support for Loki, but we will bring this concept to other datasources soon.

### Time-sync of split views in Explore

In Explore's split view, the two timepickers can now be linked so that if you change one, the other gets changed as well. This helps with keeping start and end times of the split view queries in sync and will ensure that you're looking at the same time interval in both split panes.

{{< docs-imagebox img="/img/docs/v65/explore_time_sync.gif" caption="Time-sync of split views in Explore" >}}

## Upgrading

See [upgrade notes](/installation/upgrading/#upgrading-to-v6-5).

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.
