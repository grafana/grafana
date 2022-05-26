---
description: Template to provision the Azure Monitor data source
keywords:
  - grafana
  - microsoft
  - azure
  - monitor
  - application
  - insights
  - log
  - analytics
  - guide
title: Provisioning Azure Monitor
weight: 2
---

# Configure the data source with provisioning

You can configure data sources using config files with Grafana’s provisioning system. For more information on how it works and all the settings you can set for data sources on the [Provisioning documentation page]({{< relref "../../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

## Azure AD App Registration (client secret)

```yaml
apiVersion: 1 # config file version

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: clientsecret
      cloudName: azuremonitor # See table below
      tenantId: <tenant-id>
      clientId: <client-id>
      subscriptionId: <subscription-id> # Optional, default subscription
    secureJsonData:
      clientSecret: <client-secret>
    version: 1
```

## Managed Identity

```yaml
apiVersion: 1 # config file version

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: msi
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

## Supported cloud names

| Azure Cloud                                      | Value                      |
| ------------------------------------------------ | -------------------------- |
| Microsoft Azure public cloud                     | `azuremonitor` (_default_) |
| Microsoft Chinese national cloud                 | `chinaazuremonitor`        |
| US Government cloud                              | `govazuremonitor`          |
| Microsoft German national cloud ("Black Forest") | `germanyazuremonitor`      |
