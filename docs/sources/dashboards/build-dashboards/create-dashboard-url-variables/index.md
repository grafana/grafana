---
aliases:
  - ../../variables/url-variables/
  - ../../variables/variable-types/url-variables/
keywords:
  - grafana
  - url variables
  - documentation
  - variables
  - dashboards
title: Dashboard URL variables
weight: 250
---

# Dashboard URL variables

Grafana can apply variable values passed as query parameters in dashboard URLs.
For more information, refer to [Manage dashboard links]({{< relref "../manage-dashboard-links/" >}}) and [Templates and variables]({{< relref "../../variables/" >}}).

## Passing variables as query parameters

Grafana interprets query string parameters prefixed with `var-` as variables in the given dashboard.

For example, in this URL:

```
https://${your-domain}/path/to/your/dashboard?var-example=value
```

The query parameter `var-example=value` represents the dashboard variable `example` with a value of `value`.

### Passing multiple values for a variable

To pass multiple values, repeat the variable parameter once for each value:

```
https://${your-domain}/path/to/your/dashboard?var-example=value1&var-example=value2
```

Grafana interprets `var-example=value1&var-example=value2` as the dashboard variable `example` with two values: `value1` and `value2`.

### Example

This example in [Grafana Play](https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h) passes the variable `server` with multiple values, and the variables `app` and `interval` with a single value each.

## Adding variables to dashboard links

Grafana can add variables to dashboard links when you generate them from a dashboard's settings. For more information and steps to add variables, refer to [Manage dashboard links]({{< relref "../manage-dashboard-links/" >}}).

## Passing ad hoc filters

Ad hoc filters apply key/value filters to all metric queries that use a specified data source. For more information, refer to [Add ad hoc filters]({{< relref "../../variables/add-template-variables/#add-ad-hoc-filters" >}}).

To pass an ad hoc filter as a query parameter, use the variable syntax to pass the ad hoc filter variable, and also provide the key, the operator as the value, and the value as a pipe-separated list.

For example, in this URL:

```
https://${your-domain}/path/to/your/dashboard?var-adhoc=example_key|=|example_value
```

The query parameter `var-adhoc=key|=|value` applies the ad hoc filter configured as the `adhoc` dashboard variable using the `example_key` key, the `=` operator, and the `example_value` value.

> **Note:** When sharing URLs with ad hoc filters, remember to encode the URL. In the above example, replace the pipes (`|`) with `%7C` and the equality operator (`=`) with `%3D`.

### Example

See this example in [Grafana Play](https://play.grafana.org/d/000000002/influxdb-templated?orgId=1&var-datacenter=America&var-host=All&var-summarize=1m&var-adhoc=datacenter%7C%3D%7CAmerica) - this passes the ad hoc filter variable `adhoc` with the filter value `datacenter = America`.

## Controlling time range using the URL

To set a dashboard's time range, use the `from`, `to`, `time`, and `time.window` query parameters. Because these are not variables, they do not require the `var-` prefix. For more information, see the [Linking overview]({{< relref "../" >}}).
