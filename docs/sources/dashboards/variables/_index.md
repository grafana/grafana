---
aliases:
  - ../variables/
  - ../variables/variable-examples/
  - ./
title: Variables
weight: 130
---

# Variables

The following topics describe how to add and manage variables in your dashboards:

{{< section >}}

A variable is a placeholder for a value. You can use variables in metric queries and in panel titles. So when you change
the value, using the dropdown at the top of the dashboard, your panel's metric queries will change to reflect the new value.

Variables allow you to create more interactive and dynamic dashboards. Instead of hard-coding things like server, application,
and sensor names in your metric queries, you can use variables in their place. Variables are displayed as dropdown lists at the top of
the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.
{{< figure src="/static/img/docs/v50/variables_dashboard.png" >}}

These can be especially useful for administrators who want to allow Grafana viewers to quickly adjust visualizations but do not want to give them full editing permissions. Grafana Viewers can use variables.

Variables and templates also allow you to single-source dashboards. If you have multiple identical data sources or servers, you can make one dashboard and use variables to change what you are viewing. This simplifies maintenance and upkeep enormously.

## Templates

A _template_ is any query that contains a variable.

For example, if you were administering a dashboard to monitor several servers, you _could_ make a dashboard for each server. Or you could create one dashboard and use panels with template queries like this one:

```
wmi_system_threads{instance=~"$server"}
```

Variable values are always synced to the URL using the syntax `var-<varname>=value`.

## Examples

Variables are listed in drop-down lists across the top of the screen. Select different variables to see how the visualizations change.

To see variable settings, navigate to **Dashboard Settings > Variables**. Click a variable in the list to see its settings.

Variables can be used in titles, descriptions, text panels, and queries. Queries with text that starts with `$` are templates. Not all panels will have template queries.

The following dashboards in Grafana Play provide examples of template variables.

- [Elasticsearch Metrics](https://play.grafana.org/d/z8OZC66nk/elasticsearch-8-2-0-sample-flight-data?orgId=1) - Uses ad hoc filters, global variables, and a custom variable.
- [Graphite Templated Nested](https://play.grafana.org/d/000000056/graphite-templated-nested?orgId=1) - Uses query variables, chained query variables, an interval variable, and a repeated panel.
- [Influx DB Group By Variable](https://play.grafana.org/d/000000137/influxdb-group-by-variable?orgId=1) - Query variable, panel uses the variable results to group the metric data.
- [InfluxDB Raw Query Template Var](https://play.grafana.org/d/000000083/influxdb-raw-query-template-var?orgId=1) - Uses query variables, chained query variables, and an interval variable.
- [InfluxDB Server Monitoring](https://play.grafana.org/d/AAy9r_bmk/influxdb-server-monitoring?orgId=1) - Uses query variables, chained query variables, an interval variable, and an ad hoc filter.
- [Prometheus templating](https://play.grafana.org/d/000000063/prometheus-templating?orgId=1) - Uses chained query variables.
- [Template Redux](https://play.grafana.org/d/p-k6QtkGz/template-redux?orgId=1) - Uses query variables, chained query variables, ad hoc filters, an interval variable, a text box variable, a custom variable, and a data source variable.
- [Templating, repeated panels](https://play.grafana.org/d/000000025/templating-repeated-panels?orgId=1) - Two sets of repeated panels use query variables.
- [Templating showcase](https://play.grafana.org/d/000000091/templating-showcase?orgId=1) - Uses custom, query, chained query, and data source variables.
- [Templating value groups](https://play.grafana.org/d/000000024/templating-value-groups?orgId=1) - Uses query variable with value groups.

## Variable best practices

- Variable drop-down lists are displayed in the order they are listed in the variable list in Dashboard settings.
- Put the variables that you will change often at the top, so they will be shown first (far left on the dashboard).
