---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Metrics Drilldown
aliases:
  - ../explore-metrics/ # /docs/grafana/latest/explore/explore-metrics/
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/metrics/
description: Grafana Metrics Drilldown lets you browse Prometheus-compatible metrics using an intuitive, queryless experience.
hero:
  title: Queryless metrics exploration with Grafana Metrics Drilldown
  level: 1
  width: 100
  height: 100
  description: Use Grafana Metrics Drilldown to analyze metric data without writing a PromQL query.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Metrics and telemetry
      href: ./about-metrics/
      description: Learn about metrics and the role they serve in analyzing telemetry data.
      height: 24
    - title: Set up
      href: ./set-up/
      description: Set up the Grafana Metrics Drilldown app in Grafana Cloud or in your own stack.
      height: 24
    - title: Get started
      href: ./get-started/
      description: Get started analyzing your metrics with Grafana Metrics Drilldown
      height: 24
    - title: Drill down your metrics
      href: ./drill-down-metrics/
      description: Drill down into your metrics without writing a PromQL query.
      height: 24
weight: 200
---

# Grafana Metrics Drilldown

Grafana Metrics Drilldown is a query-less experience for browsing **Prometheus-compatible** metrics. Quickly find related metrics with just a few simple clicks, without needing to write PromQL queries to retrieve metrics.

{{< docs/shared source="grafana" lookup="plugins/rename-note.md" version="<GRAFANA_VERSION>" >}}

With Metrics Drilldown, you can:

- Easily segment metrics based on their labels, so you can immediately spot anomalies and identify issues.
- Automatically display the optimal visualization for each metric type (gauge vs. counter, for example) without manual setup.
- Uncover related metrics relevant to the one you're viewing.
- “Explore in a drawer” - overlay additional content on your dashboard without losing your current view.
- View a history of user steps when navigating through metrics and their filters.
- Seamlessly pivot to related telemetry, including log data.

{{< docs/play title="Metrics Drilldown" url="https://play.grafana.org/explore/metrics/trail?from=now-1h&to=now&var-ds=grafanacloud-demoinfra-prom&var-filters=&refresh=&metricPrefix=all" >}}

## Explore

{{< card-grid key="cards" type="simple" >}}