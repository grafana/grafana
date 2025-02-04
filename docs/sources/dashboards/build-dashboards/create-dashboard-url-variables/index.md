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
  ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  manage-dashboard-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
---

# Dashboard URL variables

Dashboard URL [variables](ref:variables) allow you to provide more context when you share a dashboard URL.

For example, you could share a basic URL to your dashboard that looks like this:

```
https://${your-domain}/path/to/your/dashboard
```

This allows someone to navigate to the dashboard, but doesn't provide any helpful context that might be available.

Instead, you can add dashboard variables, passed as query parameters in the dashboard URL, to provide a URL like this:

```
https://${your-domain}/path/to/your/dashboard?var-example=value
```

This allows you to provide added context to the dashboard when someone navigates to it.

## Variables as query parameters

Grafana interprets query string parameters prefixed with `var-` as variables in the given dashboard.

For example:

```
https://${your-domain}/path/to/your/dashboard?var-example=value
```

In this URL, the query parameter `var-example=value` represents the dashboard variable `example` with a value of `value`.

### Multiple values for a variable

To pass multiple values, repeat the variable parameter once for each value:

```
https://${your-domain}/path/to/your/dashboard?var-example=value1&var-example=value2
```

Grafana interprets `var-example=value1&var-example=value2` as the dashboard variable `example` with two values: `value1` and `value2`.

### Example

[This dashboard in Grafana Play](https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h) passes the variable `server` with multiple values, and the variables `app` and `interval` with a single value each.

## Ad hoc filters

Ad hoc filters apply key/value filters to all metric queries that use the specified data source. For more information, refer to [Add ad hoc filters](ref:ad-hoc-filters).

To pass an ad hoc filter as a query parameter, use the variable syntax to pass the ad hoc filter variable. Then provide the key, operator, and value as a pipe-separated list.

For example:

```
https://${your-domain}/path/to/your/dashboard?var-adhoc=example_key|=|example_value
```

In this URL, the query parameter `var-adhoc=key|=|value` applies the ad hoc filter configured as the `adhoc` dashboard variable using the `example_key` key, the `=` operator, and the `example_value` value.

{{< admonition type="note" >}}
When sharing URLs with ad hoc filters, remember to encode the URL. In the preceding example, replace the pipes (`|`) with `%7C` and the equality operator (`=`) with `%3D`.
{{< /admonition >}}

### Example

[This dashboard in Grafana Play](https://play.grafana.org/d/p-k6QtkGz/template-redux?var-interval=$__auto&orgId=1&from=now-5m&to=now&timezone=utc&var-query=$__all&var-query2=$__all&var-query3=$__all&var-Filters=job%7C%3D%7Cmetrictank%2Ftsdb-gw&var-textbox=foo&var-custom=lisa&var-datasource=grafanacloud-demoinfra-prom) passes the ad hoc filter variable `Filters` with the filter value `job = metrictank/tsdb-gw`.

## Time range control using the URL

{{< docs/shared lookup="dashboards/time-range-URLs.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Variables in dashboard links

When you create dashboard links the dashboard settings, you can have current dashboard variables included in the link by selecting that option:

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-link-variables-11.1.png" max-width="500px" alt="Dashboard link page with variables option selected" >}}

For steps to add variables to dashboard links, refer to [Manage dashboard links](ref:manage-dashboard-links).
