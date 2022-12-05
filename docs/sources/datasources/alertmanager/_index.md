---
aliases:
  - /docs/grafana/latest/features/datasources/alertmanager/
  - /docs/grafana/latest/datasources/alertmanager/
  - /docs/grafana/latest/data-sources/alertmanager/
description: Guide for using Alertmanager as a data source in Grafana
keywords:
  - grafana
  - prometheus
  - alertmanager
  - guide
  - queries
menuTitle: Alertmanager
title: Alertmanager data source
weight: 150
---

# Alertmanager data source

Grafana includes built-in support for Alertmanager implementations in Prometheus and Mimir.
Once you add it as a data source, you can use the [Grafana Alerting UI](/docs/grafana/latest/alerting/) to manage silences, contact points, and notification policies.
To switch between Grafana and any configured Alertmanager data sources, you can select your preference from a drop-down option in those databases' data source settings pages.

## Alertmanager implementations

The data source supports [Prometheus](https://prometheus.io/) and [Grafana Mimir](https://grafana.com/docs/mimir/latest/) (default) implementations of Alertmanager.
You can specify the implementation in the data source's Settings page.
When using Prometheus, contact points and notification policies are read-only in the Grafana Alerting UI because it doesn't support updating the configuration via HTTP API.

## Provision the Alertmanager data source

You can provision Alertmanager data sources by updating Grafana's configuration files.
For more information on provisioning, and common settings available, refer to the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}}).

Here is an example for provisioning the Alertmanager data source:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
      # Options for implementation include prometheus and mimir
      implementation: prometheus
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    secureJsonData:
      basicAuthPassword: test_password
```
