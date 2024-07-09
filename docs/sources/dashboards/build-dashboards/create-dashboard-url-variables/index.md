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
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Dashboard URL variables
description: Use variables in dashboard URLs to add more context to your links
weight: 250
refs:
  add-ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  manage-dashboard-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links/
  linking-overview:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
---

# Dashboard URL variables

Dashboard URL [variables](<(ref:template-and-variables)>) allow you to provide more context when you share a dashboard URL.

For example, you could share a basic URL to your dashboard that looks like this:

```
https://${your-domain}/path/to/your/dashboard
```

This allows someone to navigate to the dashboard, but doesn't provide any helpful context that might be available.

Instead, you can add dashboard variables passed as query parameters in the dashboard URL, to provide a URL like this:

```
https://${your-domain}/path/to/your/dashboard?var-example=value
```

This allows you to provide added context to the dashboard when someone navigates to it.

This page describes different ways that you can use this functionality.

## Variables as query parameters

Grafana interprets query string parameters prefixed with `var-` as variables in the given dashboard.

For example, in this URL:

```
https://${your-domain}/path/to/your/dashboard?var-example=value
```

The query parameter `var-example=value` represents the dashboard variable `example` with a value of `value`.

### Multiple values for a variable

To pass multiple values, repeat the variable parameter once for each value:

```
https://${your-domain}/path/to/your/dashboard?var-example=value1&var-example=value2
```

Grafana interprets `var-example=value1&var-example=value2` as the dashboard variable `example` with two values: `value1` and `value2`.

### Example

This example in [Grafana Play](https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h) passes the variable `server` with multiple values, and the variables `app` and `interval` with a single value each.

## Ad hoc filters

Ad hoc filters apply key/value filters to all metric queries that use a specified data source. For more information, refer to [Add ad hoc filters](ref:add-ad-hoc-filters).

To pass an ad hoc filter as a query parameter, use the variable syntax to pass the ad hoc filter variable, and also provide the key, the operator as the value, and the value as a pipe-separated list.

For example, in this URL:

```
https://${your-domain}/path/to/your/dashboard?var-adhoc=example_key|=|example_value
```

The query parameter `var-adhoc=key|=|value` applies the ad hoc filter configured as the `adhoc` dashboard variable using the `example_key` key, the `=` operator, and the `example_value` value.

{{% admonition type="note" %}}
When sharing URLs with ad hoc filters, remember to encode the URL. In the above example, replace the pipes (`|`) with `%7C` and the equality operator (`=`) with `%3D`.
{{% /admonition %}}

### Example

[This example in Grafana Play](https://play.grafana.org/d/000000002/influxdb-templated?orgId=1&var-datacenter=America&var-host=All&var-summarize=1m&var-adhoc=datacenter%7C%3D%7CAmerica) passes the ad hoc filter variable `adhoc` with the filter value `datacenter = America`.

## Time range control using the URL

To set a dashboard's time range, use the `from`, `to`, `time`, and `time.window` query parameters. Because these are not variables, they do not require the `var-` prefix. For more information, see the [Linking overview](ref:linking-overview).

<!-- add example here -->

## Variables in dashboard links

You can add variables to dashboard links that you create in a dashboard's settings.

<!-- screenshot here -->

For steps to add variables to dashboard links, refer to [Manage dashboard links](ref:manage-dashboard-links).
