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
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure the InfluxDB data source
title: Configure the InfluxDB data source
weight: 300
refs:
  provision-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#provision-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#provision-grafana
---

# Configure the InfluxDB data source

This document provides instructions for configuring the InfluxDB data source and explains the available configuration options.

## Before you begin

To configure the InfluxDB data source you must have the `Administrator` role.

{{< admonition type="note" >}}
Select the query language you want to use with InfluxDB before adding the InfluxDB data source. Configuration options differ based on query language type.
{{< /admonition >}}

InfluxData provides three query languages. Some key points to consider:

- SQL is only available for InfluxDB v3.x.
- Flux is a functional data scripting language for InfluxDB 2.x. Refer to [Query InfluxDB with Flux](https://docs.influxdata.com/influxdb/cloud/query-data/get-started/query-influxdb/) for a basic guide on working with Flux.
- InfluxQL is SQL-like query language developed by InfluxData. It doesn't support more advanced functions such as JOINs.

To help choose the best language for your needs, refer to
a [comparison of Flux vs InfluxQL](https://docs.influxdata.com/influxdb/v1.8/flux/flux-vs-influxql/)
and [Why InfluxData created Flux](https://www.influxdata.com/blog/why-were-building-flux-a-new-data-scripting-and-query-language/).

## Add the InfluxDB data source

Complete the following steps to set up a new InfluxDB data source:

1. Click **Connections** in the left-side menu.
2. Click **Add new connection**.
3. Type `InfluxDB` in the search bar.
4. Select the **InfluxDB** data source.
5. Click **Add new data source** in the upper right.

You are taken to the **Settings** tab where you will configure the data source.

## InfluxDB common configuration options

The following configuration options apply to **all three query language options**.

- **Name** - Sets the name you use to refer to the data source in panels and queries. Examples: `InfluxDB-InfluxQL`, `InfluxDB_SQL`.
- **Default** - Toggle to set as the default data source.
- **Query language** - Select the query language for your InfluxDB instance. The three options are:
  - **InfluxQL** - SQL-like language for querying InfluxDB, with statements such as SELECT, FROM, WHERE, and GROUP BY that are familiar to SQL users.
  - **SQL** - Native SQL language starting with InfluxDB v.3.0. Refer to InfluxData's [SQL reference documentation](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/) for a list of supported statements, operators, and functions.
  - **Flux** - Flux is a data scripting language developed by InfluxData that allows you to query, analyze, and act on data. Refer to [Get started with Flux](https://docs.influxdata.com/influxdb/cloud/query-data/get-started/) for guidance on using Flux.

**HTTP section:**

- **URL** - The HTTP protocol, IP address, and port of your InfluxDB API. InfluxDB’s default API port is `8086`.
- **Allowed cookies** - Defines which cookies are forwarded to the data source. All other cookies are deleted by default.
- **Timeout** - Set an HTTP request timeout in seconds.

**Auth section:**

- **Basic auth** - The most common authentication method. Use your InfluxData user name and password to authenticate. Toggling requires you to add the user and password under **Basic auth details**.
- **With credentials** - Toggle to enable credentials such as cookies or auth headers to be sent with cross-site requests.
- **TLS client auth** - Toggle to use client authentication. When enabled, add the `Server name`, `Client cert` and `Client key` under the **TLS/SSL auth details** section. The client provides a certificate that the server validates to establish the client’s trusted identity. The client key encrypts the data between client and server.
- **With CA cert** - Authenticate with a CA certificate. Follow the instructions of your CA (Certificate Authority) to download the certificate file.
- **Skip TLS verify** - Toggle to bypass TLS certificate validation.
- **Forward OAuth identity** - Forward the OAuth access token (and also the OIDC ID token if available) of the user querying the data source.

**Basic auth details:**

If you enable **Basic auth** under the Auth section you need to configure the following:

- **User** - Add the username used to sign in to InfluxDB.
- **Password** - Defines the token you use to query the bucket defined in **Database**. Retrieve this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) in the InfluxDB UI.

**TLS/SSL auth details:**

TLS/SSL certificates are encrypted and stored in the Grafana database.

- **CA cert** - If you toggle **With CA cert** add your self-signed cert here.
- **Server name** - Name of the server. Example: server1.domain.com
- **Client cert** - Add the client certificate.
- **Client key** - Add the client key.

**Custom HTTP headers:**

- **Header** - Add a custom HTTP header. Select an option from the drop-down. Allows custom headers to be passed based on the needs of your InfluxDB instance.
- **Value** - The value for the header.

**Private data source connect:**

- **Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

Click **Manage private data source connect** to be taken to your PDC connection page, where you'll find your PDC configuration details.

Once you have added your connection settings, click **Save & test** to test the data source connection.

### InfluxQL-specific configuration section

The following settings are specific to the InfluxQL query language option.

**InfluxQL InfluxDB details section:**

- **Database** - Sets the ID of the bucket to query. Refer to [View buckets](https://docs.influxdata.com/influxdb/v2.0/organizations/buckets/view-buckets/) in InfluxData's documentation on how to locate the list of available buckets and their corresponding IDs.
- **User** - The user name used to sign in to InfluxDB.
- **Password** - Defines the token used to query the bucket defined in **Database**. Retrieve the password from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI.
- **HTTP method** - Sets the HTTP method used to query your data source. The POST method allows for larger queries that would return an error using the GET method. The default method is `POST`.
- **Min time interval** - _(Optional)_ Sets the minimum time interval for auto group-by. Grafana recommends setting this to match the data write frequency. For example, if your data is written every minute, it’s recommended to set this interval to 1 minute, so that each group contains data from each new write. The default is `10s`. Refer to [Min time interval](#min-time-interval) for format examples.
- **Autocomplete range** - _(Optional)_ Sets a time range limit for the query editor's autocomplete to reduce the execution time of tag filter queries. As a result, any tags not present within the defined time range will be filtered out. For example, setting the value to 12h will include only tag keys/values from the past 12 hours. This feature is recommended for use with very large databases, where significant performance improvements can be observed.
- **Max series** - _(Optional)_ Sets a limit on the maximum number of series or tables that Grafana processes. Set a lower limit to prevent system overload, or increase it if you have many small time series and need to display more of them. The default is `1000`.

### SQL-specific configuration section

The following settings are specific to the SQL query language option.

**SQL InfluxDB details section:**

- **Database** - Specify the **bucket ID**. Refer to the **Buckets page** in the InfluxDB UI to locate the ID.
- **Token** The API token used for SQL queries. Generated on InfluxDB Cloud dashboard under [Load Data > API Tokens](https://docs.influxdata.com/influxdb/cloud-serverless/get-started/setup/#create-an-all-access-api-token) menu.
- **Insecure Connection** - Toggle to disable gRPC TLS security.
- **Max series** - _(Optional)_ Sets a limit on the maximum number of series or tables that Grafana processes. Set a lower limit to prevent system overload, or increase it if you have many small time series and need to display more of them. The default is `1000`.

### Flux-specific configuration section

The following settings are specific to the Flux query language option.

**Flux InfluxDB details section:**

- **Organization** - The [Influx organization](https://v2.docs.influxdata.com/v2.0/organizations/) used for Flux queries. Also used for the `v.organization` query macro.
- **Token** - The authentication token used for Flux queries. With Influx 2.0, use the [influx authentication token to function](https://v2.docs.influxdata.com/v2.0/security/tokens/create-token/). Token must be set as `Authorization` header with the value `Token <generated-token>`. For Influx 1.8, the token is `username:password`.
- **Default bucket** - _(Optional)_ The [Influx bucket](https://v2.docs.influxdata.com/v2.0/organizations/buckets/) used for the `v.defaultBucket` macro in Flux queries.
- **Min time interval** - Sets the minimum time interval for auto group-by. Grafana recommends aligning this setting with the data write frequency. For example, if data is written every minute, set the interval to 1 minute to ensure each group includes data from every new write. The default is `10s`.
- **Max series** - Sets a limit on the maximum number of series or tables that Grafana processes. Set a lower limit to prevent system overload, or increase it if you have many small time series and need to display more of them. The default is `1000`.

### Min time interval

The **Min time interval** setting defines a lower limit for the auto group-by time interval.

This value **must be** formatted as a number followed by a valid time identifier:

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

You can also override this setting in a dashboard panel under its data source options.

## Provision the InfluxDB data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer
to [Provision Grafana](ref:provision-grafana).

{{< admonition type="note" >}}
The `database` [field is deprecated](https://github.com/grafana/grafana/pull/58647).
Grafana recommends using the `dbName` field in `jsonData`. There is no need to change existing provisioning settings.
{{< /admonition >}}

### Provisioning examples

Provisioning differs based on query language.

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
      dbName: site
      httpHeaderName1: 'Authorization'
    secureJsonData:
      httpHeaderValue1: 'Token <token>'
```

**InfluxDB 3.x for SQL example:**

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB_v3_InfluxQL
    type: influxdb
    access: proxy
    url: http://localhost:8086
    jsonData:
      version: SQL
      dbName: site
      httpMode: POST
      insecureGrpc: false
    secureJsonData:
      token: '<api-token>'
```
