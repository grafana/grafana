---
aliases:
  - ../features/datasources/alertmanager/
description: Guide for using Alertmanager in Grafana
keywords:
  - grafana
  - prometheus
  - guide
title: Alertmanager
weight: 150
---

# Alertmanager data source

Grafana includes built-in support for Prometheus Alertmanager. It is presently in alpha and not accessible unless [alpha plugins are enabled in Grafana settings](https://grafana.com/docs/grafana/latest/administration/configuration/#enable_alpha-1). Once you add it as a data source, you can use the [Grafana alerting UI](https://grafana.com/docs/grafana/latest/alerting/) to manage silences, contact points as well as notification policies. A drop-down option in these pages allows you to switch between Grafana and any configured Alertmanager data sources.

## Alertmanager implementations

[Prometheus](https://prometheus.io/) and [Cortex](https://cortexmetrics.io/) (default) implementations of Alertmanager are supported. You can specify implementation in the data source settings page. In case of Prometheus contact points and notification policies are read-only in the Grafana alerting UI, as it does not support updating configuration via HTTP API.

## Provision the Alertmanager data source

Configure the Alertmanager data sources by updating Grafana's configuration files. For more information on how it works and the settings available, refer to the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}}).

Here is an example for provisioning the Alertmanager data source:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
      implementation: 'prometheus' # alternatively 'cortex'
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    basicAuthPassword: test_password
```
