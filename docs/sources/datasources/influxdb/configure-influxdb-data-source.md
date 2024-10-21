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
weight: 710
refs:
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
---

# Configure the InfluxDB data source



## Before you begin

To configure the InfluxDB data source you must have the `Administrator` role.

InfluxData provides three query languages. Some key points to consider:

- SQL is only available for InfluxDB v3.x.
- Flux is a functional data scripting language for InfluxDB 2.x. Refer to [Query InfluxDB with Flux](https://docs.influxdata.com/influxdb/cloud/query-data/get-started/query-influxdb/) for a basic guide on working with Flux.
- InfluxQL - SQL-like query language developed by InfluxData.

{{< admonition type="note" >}}
You should decide which query language to use with InfluxDB before adding the InfluxDB data source. Configuration options differ based on query language type.
{{< /admonition >}}

## Add the data source

Complete the following steps to set up a new InfluxDB data source:

1. Click **Connections** in the left-side menu.
2. Click **Add new connection**.
3. Type `InfluxDB` in the search bar.
4. Select the **InfluxDB** data source.
5. Click **Add new data source** in the upper right.

You are taken to the **Settings** tab where you will configure the data source.

- **Name** -  Sets the name you use to refer to the data source in panels and queries. Examples: `InfluxDB-InfluxQL`, `InfluxDB_SQL`.
- **Default** - Toggle to set as the default data source.  
- **Query language** - Select the query language for your InfluxDB instance. The three options are:
  - **InfluxQL** -  SQL-like language for querying InfluxDB, with statements such as SELECT, FROM, WHERE, and GROUP BY that are familiar to SQL users.
  - **SQL** -  Native SQL language starting with InfluxDB v.3.0.  Refer to InfluxData's [SQL reference documentation](https://docs.influxdata.com/influxdb/cloud-serverless/reference/sql/) for a list of supported statements, operators, and functions.
  - **Flux** - Flux is a data scripting language developed by InfluxData that allows you to query, analyze, and act on data. Refer to [Get started with Flux](https://docs.influxdata.com/influxdb/cloud/query-data/get-started/) for guidance on using Flux.

{{% admonition type="note" %}}
The query language you select will display configuration options relevant to that specific query language.
{{% /admonition %}}

To help choose the best language for your needs, refer to
a [comparison of Flux vs InfluxQL](https://docs.influxdata.com/influxdb/v1.8/flux/flux-vs-influxql/)
and [why InfluxData created Flux](https://www.influxdata.com/blog/why-were-building-flux-a-new-data-scripting-and-query-language/).

### InfluxQL configuration options

InfluxQL is a SQL-like query language developed by InfluxData. Refer to [InfluxQL reference documentation](https://docs.influxdata.com/influxdb/cloud-dedicated/reference/influxql/) for more information on statements, clauses and expressions. Following are configuration options for the InfluxQL language option.

**InfluxQL HTTP section:**

- **URL** - The HTTP protocol, IP address, and port of your InfluxDB API. InfluxDB’s default API port is 8086.
- **Allowed cookies** - Defines which cookies are forwarded to the data source. All other cookies are deleted
- **Timeout** - Set am HTTP request timeout in seconds.

**InfluxQL Auth section:**

- **Basic auth** - The most common authentication method. Use your InfluxData user name and password to authenticate. Toggling this requires that add the user and password under **Basic auth details**.
- **With credentials** - Toggle to enable credentials such as cookies or auth headers to be sent with cross-site requests.
- **TLS client auth** - Toggle to use client authentication. When enabled, add the Server name, Client cert and Client key under the **TLS/SSL auth details** section. The client provides a certificate that is validated by the server to establish the client’s trusted identity. The client key encrypts the data between client and server. 
- **With CA cert** - Authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file.
- **Skip TLS verify** - Toggle to bypass TLS certificate validation.
- **Forward OAuth identity** - Forward the OAuth access token (and also the OIDC ID token if available) of the user querying the data source.

**Basic auth details:**

If you enable **Basic auth** under the Auth section you will need to configure the following:

- **User** - Sets the username to sign into InfluxDB.
- **Password** - Defines the token you use to query the bucket defined in **Database**. Copy this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI.

**TLS/SSL auth details:**

TLS/SSL certificates are encrypted and stared int he Grafana database.

- **CA cert** - If you toggle **With CA cert** add your self-signed cert here.
- **Server name** - Name of the server. Example: sample.domain.com
- **Client cert** - Add the client certificate.
- **Client key** - Add the client key.

**Custom HTTP headers:**

- **Header** - Add a custom header. Click in the box to select from the drop-down. This allows custom headers to be passed based on the needs of your InfluxDB instance.
- **Value** - The value of the header.

**InfluxDB details section:**

- **Database** - Sets the ID of the bucket to query. Refer to [View buckets](https://docs.influxdata.com/influxdb/v2.0/organizations/buckets/view-buckets/) in InfluxData's documentation on how to locate the list of available buckets and their corresponding IDs.
- **User** - Sets the username to sign into InfluxDB.
- **Password** - Defines the token you use to query the bucket defined in **Database**. Copy this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI.
- **HTTP method** - Sets the HTTP method used to query your data source. The POST method allows for larger queries that would return an error using the GET method. Defaults to POST.
- **Min time interval** -  _(Optional)_ Refer to [Min time interval](#configure-min-time-interval). 
- **Max series** -  _(Optional)_ Limits the number of series and tables that Grafana processes. Lower this number to prevent abuse, and increase it if you have many small time series and not all are shown. Defaults to 1,000. 

**Private data source connect:**

- **Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

Click **Manage private data source connect** to be taken to your PDC connection page. Here you will find your PDC configuration details.

Once you have added your connection settings, click **Save & test** to test the data source connection.


<!-- The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options carefully:

| Name                  | Description                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**              | Sets the name you use to refer to the data source in panels and queries. We recommend something like `InfluxDB-InfluxQL`.                                                                                    |
| **Default**           | Sets whether the data source is pre-selected for new panels.                                                                                                                                                 |
| **URL**               | The HTTP protocol, IP address, and port of your InfluxDB API. InfluxDB's default API port is 8086.                                                                                                           |
| **Min time interval** | _(Optional)_ Refer to [Min time interval](#configure-min-time-interval).                                                                                                                                     |
| **Max series**        | _(Optional)_ Limits the number of series and tables that Grafana processes. Lower this number to prevent abuse, and increase it if you have many small time series and not all are shown. Defaults to 1,000. |

You can also configure settings specific to the InfluxDB data source. These options are described in the sections below. -->



<!-- ### Select a query language

InfluxDB data source options differ depending on which query language you select:

- [InfluxQL](https://docs.influxdata.com/influxdb/v1.8/query_language/explore-data/), a SQL-like language for querying
  InfluxDB, with statements such as SELECT, FROM, WHERE, and GROUP BY that are familiar to SQL users.
  InfluxQL is available in InfluxDB 1.0 onwards.
- [SQL](https://www.influxdata.com/products/sql/) native SQL language with
  support [FlightSQL](https://www.influxdata.com/glossary/apache-arrow-flight-sql/).
- [Flux](https://docs.influxdata.com/influxdb/v2.0/query-data/get-started/), which provides significantly broader
  functionality than InfluxQL. It supports not only queries but also built-in functions for data shaping, string
  manipulation, and joining to non-InfluxDB data sources, but also processing time-series data.
  It's similar to JavaScript with a functional style.

To help choose the best language for your needs, refer to
a [comparison of Flux vs InfluxQL](https://docs.influxdata.com/influxdb/v1.8/flux/flux-vs-influxql/)
and [why InfluxData created Flux](https://www.influxdata.com/blog/why-were-building-flux-a-new-data-scripting-and-query-language/).

{{% admonition type="note" %}}
Though not required, we recommend that you append your query language choice to the data source's **Name** setting:

- InfluxDB-InfluxQL
- InfluxDB-SQL
- InfluxDB-Flux

{{% /admonition %}} -->

<!-- ### Configure InfluxQL

Configure these options if you select the InfluxQL (classic InfluxDB) query language:

| Name                | Description                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Allowed cookies** | Defines which cookies are forwarded to the data source. All other cookies are deleted.                                                                                                              |
| **Database**        | Sets the ID of the bucket to query. Copy this from the [Buckets page](https://docs.influxdata.com/influxdb/v2.0/organizations/buckets/view-buckets/) of the InfluxDB UI.                            |
| **User**            | Sets the username to sign into InfluxDB.                                                                                                                                                            |
| **Password**        | Defines the token you use to query the bucket defined in **Database**. Copy this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI. |
| **HTTP mode**       | Sets the HTTP method used to query your data source. The POST verb allows for larger queries that would return an error using the GET verb. Defaults to GET.                                        | -->

### SQL configuration options

Following are configuration options for the SQL language option. Refer to InfluxData's [SQL reference documentation](https://docs.influxdata.com/influxdb/cloud-dedicated/reference/sql/) for detailed information on statements, clauses, operators and functions.

**HTTP section:**

- **URL** - The HTTP protocol, IP address, and port of your InfluxDB API. InfluxDB’s default API port is 8086.
- **Allowed cookies** - Defines which cookies are forwarded to the data source. All other cookies are deleted by default.
- **Timeout** - Set am HTTP request timeout in seconds.

**SQL Auth section:**

<!-- - **Basic auth** - A common authentication method. Use your InfluxData user name and password to authenticate.
- **With credentials** - 
- **TLS client auth** - 
- **With CA cert** - 
- **Skip TLS verify** - 
- **Forward OAuth identity** -  -->

- **Basic auth** - The most common authentication method. Use your InfluxData user name and password to authenticate. Toggling this requires that add the user and password under **Basic auth details**.
- **With credentials** - Toggle to enable credentials such as cookies or auth headers to be sent with cross-site requests.
- **TLS client auth** - Toggle to use client authentication. When enabled, add the Server name, Client cert and Client key under the **TLS/SSL auth details** section. The client provides a certificate that is validated by the server to establish the client’s trusted identity. The client key encrypts the data between client and server. 
- **With CA cert** - Authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file.
- **Skip TLS verify** - Toggle to bypass TLS certificate validation.
- **Forward OAuth identity** - Forward the OAuth acce

**Basic auth details:**

If you enable **Basic auth** under the Auth section you will need to configure the following:

- **User** - Sets the username to sign into InfluxDB.
- **Password** - Defines the token you use to query the bucket defined in **Database**. Copy this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI.

**TLS/SSL auth details:**

TLS/SSL certificates are encrypted and stared int he Grafana database.

- **CA cert** - If you toggle **With CA cert** add your self-signed cert here.
- **Server name** - Name of the server. Example: sample.domain.com
- **Client cert** - Add the client certificate.
- **Client key** - Add the client key.

**Custom HTTP headers:**

- **Header** - Add a custom header. Click in the box to select from the drop-down. This allows custom headers to be passed based on the needs of your InfluxDB instance.
- **Value** - The value of the header.

**InfluxDB details:**

- **Database**   Sets the ID of the bucket to query. Copy this from the Buckets page of the InfluxDB UI. 
- **Token** API token used for SQL queries. It can be generated on InfluxDB Cloud dashboard under [Load Data > API Tokens](https://docs.influxdata.com/influxdb/cloud-serverless/get-started/setup/#create-an-all-access-api-token) menu.
- **Insecure Connection** - Disable gRPC TLS security.
- **Max series** - Limits the number of series/tables that Grafana processes. Lower this number to prevent abuse, increase it you have lots of small time series and not all are shown. The default is 1000.

**Private data source connect:**

- **Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).

Click **Manage private data source connect** to be taken to your PDC connection page. Here you will find your PDC configuration details.

Once you have added your connection settings, click **Save & test** to test the data source connection.

<!-- Configure these options if you select the SQL query language:

| Name                    | Description                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database**            | Sets the ID of the bucket to query. Copy this from the Buckets page of the InfluxDB UI.                                                                                                                                       |
| **Token**               | API token used for SQL queries. It can be generated on InfluxDB Cloud dashboard under [Load Data > API Tokens](https://docs.influxdata.com/influxdb/cloud-serverless/get-started/setup/#create-an-all-access-api-token) menu. |
| **Insecure Connection** | Disable gRPC TLS security.                                                                                                                                                                                                    | -->
### Flux configuration options

Following are configuration options for the Flux option. Refer to InfluxData's [Get started with Flux](https://docs.influxdata.com/flux/v0/get-started/) and [Flux language specification](https://docs.influxdata.com/flux/v0/spec/) for more information on working with Flux.

**HTTP section:**

- **URL** - The HTTP protocol, IP address, and port of your InfluxDB API. InfluxDB’s default API port is 8086.
- **Allowed cookies** - Defines which cookies are forwarded to the data source. All other cookies are deleted by default.
- **Timeout** - Set am HTTP request timeout in seconds.

**Flux Auth section:**

- **Basic auth** - The most common authentication method. Enabled by default. Use your InfluxData user name and password to authenticate. Toggling this requires that add the user and password under **Basic auth details**.
- **With credentials** - Toggle to enable credentials such as cookies or auth headers to be sent with cross-site requests.
- **TLS client auth** - Toggle to use client authentication. When enabled, add the Server name, Client cert and Client key under the **TLS/SSL auth details** section. The client provides a certificate that is validated by the server to establish the client’s trusted identity. The client key encrypts the data between client and server. 
- **With CA cert** - Authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file.
- **Skip TLS verify** - Toggle to bypass TLS certificate validation.
- **Forward OAuth identity** - Forward the OAuth acce

**Basic auth details:**

If you enable **Basic auth** under the Auth section you will need to configure the following:

- **User** - Sets the username to sign into InfluxDB.
- **Password** - Defines the token you use to query the bucket defined in **Database**. Copy this from the [Tokens page](https://docs.influxdata.com/influxdb/v2.0/security/tokens/view-tokens/) of the InfluxDB UI.

**TLS/SSL auth details:**

TLS/SSL certificates are encrypted and stared int he Grafana database.

- **CA cert** - If you toggle **With CA cert** add your self-signed cert here.
- **Server name** - Name of the server. Example: sample.domain.com
- **Client cert** - Add the client certificate.
- **Client key** - Add the client key.

**Custom HTTP headers:**

- **Header** - Add a custom header. Click in the box to select from the drop-down. This allows custom headers to be passed based on the needs of your InfluxDB instance.
- **Value** - The value of the header.
Flux details

- **Organization** - The [Influx organization](https://v2.docs.influxdata.com/v2.0/organizations/) used for Flux queries. Also used to for the `v.organization` query macro.
- **Token** - The authentication token used for Flux queries. With Influx 2.0, use the [influx authentication token to function](https://v2.docs.influxdata.com/v2.0/security/tokens/create-token/). Token must be set as `Authorization` header with the value `Token <generated-token>`. For influx 1.8, the token is `username:password`. 
- **Default bucket** -  _(Optional)_ The [Influx bucket](https://v2.docs.influxdata.com/v2.0/organizations/buckets/) that will be used for the `v.defaultBucket` macro in Flux queries.


Configure these options if you select the Flux query language:

<!-- | Name               | Description                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Organization**   | The [Influx organization](https://v2.docs.influxdata.com/v2.0/organizations/) that will be used for Flux queries. This is also used to for the `v.organization` query macro.                                                                                                                                                   |
| **Token**          | The authentication token used for Flux queries. With Influx 2.0, use the [influx authentication token to function](https://v2.docs.influxdata.com/v2.0/security/tokens/create-token/). Token must be set as `Authorization` header with the value `Token <generated-token>`. For influx 1.8, the token is `username:password`. |
| **Default bucket** | _(Optional)_ The [Influx bucket](https://v2.docs.influxdata.com/v2.0/organizations/buckets/) that will be used for the `v.defaultBucket` macro in Flux queries.                                                                                                                                                                | -->




### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer
to [Provisioning Grafana][provisioning-data-sources].

{{% admonition type="note" %}}
`database` [field is deprecated](https://github.com/grafana/grafana/pull/58647).
We suggest to use `dbName` field in `jsonData`. Please see the examples below.
No need to change existing provisioning settings.
{{% /admonition %}}

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

Grafana recommends setting this value to match your InfluxDB write frequency.
For example, use `1m` if InfluxDB writes data every minute.

You can also override this setting in a dashboard panel under its data source options.

