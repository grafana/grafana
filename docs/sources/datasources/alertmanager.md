+++
title = "Alertmanager"
description = "Guide for using Alertmanager in Grafana"
keywords = ["grafana", "prometheus", "guide"]
aliases = ["/docs/grafana/latest/features/datasources/alertmanager"]
weight = 1300
+++

# Alertmanager data source

Grafana includes built-in support for Prometheus Alertmanager. Add it as a datasource and you will be able to use the [Grafana alerting UI](https://grafana.com/docs/grafana/latest/alerting/) to manage silences, contact points and notification policies. It is not currently available as a data source for panels.
Refer to [Add a data source]({{< relref "add-a-data-source.md" >}}) for instructions on how to add a data source to Grafana. Only users with the organization admin role can add data sources.

>**Note:** New in Grafana 8.0.

>**Note:** Currently only [Cortex Alertmanager](https://cortexmetrics.io/docs/proposals/scalable-alertmanager/) is supported.

>**Note:** It is presently in alpha and not accessible unles alpha plugins are [enabled in Grafana settings](https://grafana.com/docs/grafana/latest/administration/configuration/#enable_alpha).

## Provision the Alertmanager data source

You can configure data sources using config files with Grafana's provisioning system. Read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}}).

Here is an example for provisioning this datasource:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9090
    access: proxy
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    basicAuthPassword: test_password
```