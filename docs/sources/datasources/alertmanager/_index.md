---
aliases:
  - ../data-sources/alertmanager/
  - ../features/datasources/alertmanager/
description: Guide for using Alertmanager as a data source in Grafana
keywords:
  - grafana
  - prometheus
  - alertmanager
  - guide
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alertmanager
title: Alertmanager data source
weight: 150
refs:
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
---

# Alertmanager data source

Grafana includes built-in support for Alertmanager implementations in Prometheus and Mimir.

Once you add an Alertmanager as a data source, you can use the `Choose Alertmanager` drop-down on [Grafana Alerting](ref:alerting) to view and manage Alertmanager resources, such as silences, contact points, and notification policies. Additionally, you can enable the Alertmanager to receive Grafana-managed alerts.

For more details about using other Alertmanagers, refer to [Alertmanagers in the Grafana Alerting documentation](ref:configure-alertmanager).

## Alertmanager implementations

The data source supports [Prometheus](https://prometheus.io/) and [Grafana Mimir](/docs/mimir/latest/) (default) implementations of Alertmanager. You can specify the implementation in the data source's Settings page.

When using Prometheus, you can manage silences in the Grafana Alerting UI. However, other Alertmanager resources such as contact points, notification policies, and templates are read-only because the Prometheus Alertmanager HTTP API does not support updates for these resources.

## Configure the data source

To configure basic settings for the data source, complete the following steps:

{{< docs/shared lookup="alerts/add-alertmanager-ds.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Provision the Alertmanager data source

You can provision Alertmanager data sources by updating Grafana's configuration files.
For more information on provisioning, and common settings available, refer to the [provisioning docs page](ref:data-sources).

Here is an example for provisioning the Alertmanager data source:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
      # Valid options for implementation include mimir, cortex and prometheus
      implementation: prometheus
      # Whether or not Grafana should send alert instances to this Alertmanager
      handleGrafanaManagedAlerts: false
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    secureJsonData:
      basicAuthPassword: test_password
```
