---
description: Guide for provisioning InfluxDB
title: Provision InfluxDB
weight: 400
---

# Provision InfluxDB

You can configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}}).

Here are some provisioning examples for this data source.

## InfluxDB 1.x example

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v1
    type: influxdb
    access: proxy
    database: site
    user: grafana
    url: http://localhost:8086
    jsonData:
      httpMode: GET
    secureJsonData:
      password: grafana
```

## InfluxDB 2.x for Flux example

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v2_Flux
    type: influxdb
    access: proxy
    url: http://localhost:8086
    secureJsonData:
      token: token
    jsonData:
      version: Flux
      organization: organization
      defaultBucket: bucket
      tlsSkipVerify: true
```

## InfluxDB 2.x for InfluxQl example

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v2_InfluxQL
    type: influxdb
    access: proxy
    url: http://localhost:8086
    # This database should be mapped to a bucket
    database: site
    jsonData:
      httpMode: GET
      httpHeaderName1: 'Authorization'
    secureJsonData:
      httpHeaderValue1: 'Token <token>'
```
