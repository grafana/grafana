---
aliases:
  - ../data-sources/influxdb/
  - ../data-sources/influxdb/provision-influxdb/
  - ../features/datasources/influxdb/
  - provision-influxdb/
description: Guide for using InfluxDB in Grafana
keywords:
  - grafana
  - influxdb
  - guide
  - flux
menuTitle: InfluxDB
title: InfluxDB data source
weight: 700
---

# InfluxDB data source

{{< docs/shared "influxdb/intro.md" >}}

Grafana includes built-in support for InfluxDB.
This topic explains options, variables, querying, and other features specific to the InfluxDB data source, which include its [feature-rich code editor for queries and visual query builder]({{< relref "./query-editor/" >}}).

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

Once you've added the InfluxDB data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor/" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}) and use [Explore]({{< relref "../../explore/" >}}).

## Configure the data source

**To access the data source configuration page:**

1. Hover the cursor over the **Configuration** (gear) icon.
1. Select **Data Sources**.
1. Select the InfluxDB data source.

Set the data source's basic configuration options carefully:

| Name                  | Description                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**              | Sets the name you use to refer to the data source in panels and queries. We recommend something like `InfluxDB-InfluxQL`.                                                                                    |
| **Default**           | Sets whether the data source is pre-selected for new panels.                                                                                                                                                 |
| **URL**               | The HTTP protocol, IP address, and port of your InfluxDB API. InfluxDB's default API port is 8086.                                                                                                           |
| **Min time interval** | _(Optional)_ Refer to [Min time interval]({{< relref "#configure-min-time-interval" >}}).                                                                                                                    |
| **Max series**        | _(Optional)_ Limits the number of series and tables that Grafana processes. Lower this number to prevent abuse, and increase it if you have many small time series and not all are shown. Defaults to 1,000. |

You can also configure settings specific to the InfluxDB data source:

### Min time interval

The **Min time interval** setting defines a lower limit for the auto group-by time interval.

This value _must_ be formatted as a number followed by a valid time identifier:

| Identifier | Description |
| ---------- | ----------- |
| `y`        | year        |
| `M`        | month       |
| `w`        | week        |
| `d`        | day         |
| `h`        | hour        |
| `m`        | minute      |
| `s`        | second      |
| `ms`       | millisecond |

We recommend setting this value to match your InfluxDB write frequency.
For example, use `1m` if InfluxDB writes data every minute.

You can also override this setting in a dashboard panel under its data source options.

### Select a query language

InfluxDB data source options differ depending on which query language you select:

- [InfluxQL](https://docs.influxdata.com/influxdb/v1.8/query_language/explore-data/), a SQL-like language for querying InfluxDB, with statements such as SELECT, FROM, WHERE, and GROUP BY that are familiar to SQL users.
  InfluxQL is available in InfluxDB 1.0 onwards.
- [Flux](https://docs.influxdata.com/influxdb/v2.0/query-data/get-started/), which provides significantly broader functionality than InfluxQL. It supports not only queries but also built-in functions for data shaping, string manipulation, and joining to non-InfluxDB data sources, but also processing time-series data.
  It's similar to JavaScript with a functional style.

To help choose the best language for your needs, refer to a [comparison of Flux vs InfluxQL](https://docs.influxdata.com/influxdb/v1.8/flux/flux-vs-influxql/) and [why InfluxData created Flux](https://www.influxdata.com/blog/why-were-building-flux-a-new-data-scripting-and-query-language/).

> **Note:** Though not required, we recommend that you append your query language choice to the data source's **Name** setting:
>
> - InfluxDB-InfluxQL
> - InfluxDB-Flux

### Configure InfluxQL

Configure these options if you select the InfluxQL (classic InfluxDB) query language:

| Name                | Description                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Access**          | Only Server access mode is functional. Direct browser access is deprecated.                                                                                                                         |
| **Allowed cookies** | Defines which cookies are forwarded to the data source. All other cookies are deleted.                                                                                                              |
| **Database**        | Sets the ID of the bucket to query. Copy this from the [Buckets page](https://docs.influxdata.com/influxdb/v2.0/organizations/buckets/view-buckets/) of the InfluxDB UI.                            |
| **User**            | Sets the username to sign into InfluxDB.                                                                                                                                                            |
| **Password**        | Defines the token you use to query the bucket defined in **Database**. Copy this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI. |
| **HTTP mode**       | Sets the HTTP method used to query your data source. The POST verb allows for larger queries that would return an error using the GET verb. Defaults to GET.                                        |

### Configure Flux

Configure these options if you select the Flux query language:

| Name               | Description                                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organization**   | The [Influx organization](https://v2.docs.influxdata.com/v2.0/organizations/) that will be used for Flux queries. This is also used to for the `v.organization` query macro.                                                             |
| **Token**          | The authentication token used for Flux queries. With Influx 2.0, use the [influx authentication token to function](https://v2.docs.influxdata.com/v2.0/security/tokens/create-token/). For influx 1.8, the token is `username:password`. |
| **Default bucket** | _(Optional)_ The [Influx bucket](https://v2.docs.influxdata.com/v2.0/organizations/buckets/) that will be used for the `v.defaultBucket` macro in Flux queries.                                                                          |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

> **Note:** `database` [field is deprecated](https://github.com/grafana/grafana/pull/58647).
> We suggest to use `dbName` field in `jsonData`. Please see the examples below.
> No need to change existing provisioning settings.

#### Provisioning examples

**InfluxDB 1.x example:**

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v1
    type: influxdb
    access: proxy
    user: grafana
    url: http://localhost:8086
    jsonData:
      dbName: site
      httpMode: GET
    secureJsonData:
      password: grafana
```

**InfluxDB 2.x for Flux example:**

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v2_Flux
    type: influxdb
    access: proxy
    url: http://localhost:8086
    jsonData:
      version: Flux
      organization: organization
      defaultBucket: bucket
      tlsSkipVerify: true
    secureJsonData:
      token: token
```

**InfluxDB 2.x for InfluxQL example:**

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v2_InfluxQL
    type: influxdb
    access: proxy
    url: http://localhost:8086
    jsonData:
      # This database should be mapped to a bucket
      dbName: site
      httpMode: GET
      httpHeaderName1: 'Authorization'
    secureJsonData:
      httpHeaderValue1: 'Token <token>'
```

## Query the data source

The InfluxDB data source's query editor has two modes, InfluxQL and Flux, depending on your choice of query language in the [data source configuration]({{< relref "#configure-the-data-source" >}}):

For details, refer to the [query editor documentation]({{< relref "./query-editor/" >}}).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation]({{< relref "./template-variables/" >}}).
