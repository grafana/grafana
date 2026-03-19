---
keywords:
  - grafana
  - documentation
  - developers
  - resources
  - data model
title: Grafana APIs
weight: 300
cards:
  items:
    - title: HTTP API
      height: 24
      href: ./http-api/
      description: Every Grafana instance exposes an HTTP API, which is the same API used by the Grafana frontend to manage resources like saving dashboards, creating users, updating data sources, deleting alerts, and more. You can use the HTTP API to programmatically access or manage resources from your Grafana instance.
    - title: Grafana Cloud API
      height: 24
      href: ./cloud-api/
      description: The Grafana Cloud API, sometimes referred to as the Grafana.com API or GCOM API, allows you to interact with resources from your Grafana Cloud Stack programmatically.
    - title: Tracing API
      height: 24
      href: ./tracing-api/
      description: Tempo exposes an API for pushing and querying traces, and operating the cluster itself.
    - title: Synthetic Monitoring API
      height: 24
      href: ./synthetic-monitoring-api/
      description: The Grafana Cloud Synthetic Monitoring REST API provides programmatic access to Synthetic Monitoring resources.
---

# Grafana APIs

Refer to the following API reference guides:

{{< card-grid key="cards" type="simple" >}}
