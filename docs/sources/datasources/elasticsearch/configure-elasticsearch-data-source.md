---
aliases:
  - ../data-sources/elasticsearch/
  - ../features/datasources/elasticsearch/
description: Guide for configuring the Elasticsearch data source in Grafana
keywords:
  - grafana
  - elasticsearch
  - guide
  - data source
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure Elasticsearch
title: Configure the Elasticsearch data source
weight: 200
refs:
  administration-documentation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  supported-expressions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#log-level
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#log-level
  query-and-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
---

# Configure the Elasticsearch data source

Grafana ships with built-in support for Elasticsearch.
You can create a variety of queries to visualize logs or metrics stored in Elasticsearch, and annotate graphs with log events stored in Elasticsearch.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:administration-documentation).

Only users with the organization `administrator` role can add data sources.
Administrators can also [configure the data source via YAML](ref:provisioning-data-sources) with Grafana's provisioning system.

## Configuring permissions

When Elasticsearch security features are enabled, it is essential to configure the necessary cluster privileges to ensure seamless operation. Below is a list of the required privileges along with their purposes:

- **monitor** - Necessary to retrieve the version information of the connected Elasticsearch instance.
- **view_index_metadata** - Required for accessing mapping definitions of indices.
- **read** - Grants the ability to perform search and retrieval operations on indices. This is essential for querying and extracting data from the cluster.

## Add the data source

To add the Elasticsearch data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under **Connections**, click **Add new connection**.
1. Enter `Elasticsearch` in the search bar.
1. Click **Elasticsearch** under the **Data source** section.
1. Click **Add new data source** in the upper right.

You will be taken to the **Settings** tab where you will set up your Elasticsearch configuration.

## Configuration options

The following is a list of configuration options for Elasticsearch.

The first option to configure is the name of your connection:

- **Name** - The data source name. This is how you refer to the data source in panels and queries. Examples: elastic-1, elasticsearch_metrics.

- **Default** - Toggle to select as the default data source option. When you go to a dashboard panel or Explore, this will be the default selected data source.

## Connection

Connect the Elasticsearch data source by specifying a URL.

- **URL** - The URL of your Elasticsearch server. If your Elasticsearch server is local, use `http://localhost:9200`. If it is on a server within a network, this is the URL with the port where you are running Elasticsearch. Example: `http://elasticsearch.example.orgname:9200`.

## Authentication

There are several authentication methods you can choose in the Authentication section.
Select one of the following authentication methods from the dropdown menu.

- **Basic authentication** - The most common authentication method. Use your `data source` user name and `data source` password to connect.

- **Forward OAuth identity** - Forward the OAuth access token (and the OIDC ID token if available) of the user querying the data source.

- **No authentication** - Make the data source available without authentication. Grafana recommends using some type of authentication method.

<!-- - **With credentials** - Toggle to enable credentials such as cookies or auth headers to be sent with cross-site requests. -->

### TLS settings

{{% admonition type="note" %}}
Use TLS (Transport Layer Security) for an additional layer of security when working with Elasticsearch. For information on setting up TLS encryption with Elasticsearch see [Configure TLS](https://www.elastic.co/guide/en/elasticsearch/reference/8.8/configuring-tls.html#configuring-tls). You must add TLS settings to your Elasticsearch configuration file **prior** to setting these options in Grafana.
{{% /admonition %}}

- **Add self-signed certificate** - Check the box to authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file. Required for verifying self-signed TLS certificates.

- **TLS client authentication** - Check the box to authenticate with the TLS client, where the server authenticates the client. Add the `Server name`, `Client certificate` and `Client key`. The **ServerName** is used to verify the hostname on the returned certificate. The **Client certificate** can be generated from a Certificate Authority (CA) or be self-signed. The **Client key** can also be generated from a Certificate Authority (CA) or be self-signed. The client key encrypts the data between client and server.

- **Skip TLS certificate validation** - Check the box to bypass TLS certificate validation. Skipping TLS certificate validation is not recommended unless absolutely necessary or for testing purposes.

### HTTP headers

Click **+ Add header** to add one or more HTTP headers. HTTP headers pass additional context and metadata about the request/response.

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Elasticsearch instance.

- **Value** - The value of the header.

## Additional settings

Additional settings are optional settings that can be configured for more control over your data source.

### Advanced HTTP settings

- **Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.

- **Timeout** - The HTTP request timeout. This must be in seconds. There is no default, so this setting is up to you.

### Elasticsearch details

The following settings are specific to the Elasticsearch data source.

- **Index name** - Use the index settings to specify a default for the `time field` and your Elasticsearch index's name. You can use a time pattern, such as `YYYY.MM.DD`, or a wildcard for the index name.

- **Pattern** - Select the matching pattern if using one in your index name. Options include:

  - no pattern
  - hourly
  - daily
  - weekly
  - monthly
  - yearly

- **Time field name** - Name of the time field. The default value is @timestamp. You can enter a different name.

- **Max concurrent shard requests** - Sets the number of shards being queried at the same time. The default is `5`. For more information on shards see [Elasticsearch's documentation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/scalability.html#scalability).

- **Min time interval** - Defines a lower limit for the auto group-by time interval. This value **must** be formatted as a number followed by a valid time identifier:

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

We recommend setting this value to match your Elasticsearch write frequency.
For example, set this to `1m` if Elasticsearch writes data every minute.

You can also override this setting in a dashboard panel under its data source options. The default is `10s`.

- **X-Pack enabled** - Toggle to enable `X-Pack`-specific features and options, which provide the [query editor]({{< relref "./query-editor" >}}) with additional aggregations, such as `Rate` and `Top Metrics`.

- **Include frozen indices** - Toggle on when the `X-Pack enabled` setting is active. Includes frozen indices in searches. You can configure Grafana to include [frozen indices](https://www.elastic.co/guide/en/elasticsearch/reference/7.13/frozen-indices.html) when performing search requests.

{{% admonition type="note" %}}
Frozen indices are [deprecated in Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/frozen-indices.html) since v7.14.
{{% /admonition %}}

### Logs

In this section you can configure which fields the data source uses for log messages and log levels.

- **Message field name:** - Grabs the actual log message from the default source.

- **Level field name:** - Name of the field with log level/severity information. When a level label is specified, the value of this label is used to determine the log level and update the color of each log line accordingly. If the log doesn’t have a specified level label, we try to determine if its content matches any of the [supported expressions](ref:supported-expressions). The first match always determines the log level. If Grafana cannot infer a log-level field, it will be visualized with an unknown log level.

### Data links

Data links create a link from a specified field that can be accessed in Explore's logs view. You can add multiple data links by clicking **+ Add**.

Each data link configuration consists of:

- **Field** - Sets the name of the field used by the data link.

- **URL/query** - Sets the full link URL if the link is external. If the link is internal, this input serves as a query for the target data source.<br/>In both cases, you can interpolate the value from the field with the `${__value.raw }` macro.

- **URL Label** (Optional) - Sets a custom display label for the link. The link label defaults to the full external URL or name of the linked internal data source and is overridden by this setting.

- **Internal link** - Toggle on to set an internal link. For an internal link, you can select the target data source with a data source selector. This supports only tracing data sources.

## Private data source connect (PDC) and Elasticsearch

Use private data source connect (PDC) to connect to and query data within a secure network without opening that network to inbound traffic from Grafana Cloud. See [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) for more information on how PDC works and [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc) for steps on setting up a PDC connection.

- **Private data source connect** - Click in the box to set the default PDC connection from the dropdown menu or create a new connection.

Once you have configured your Elasticsearch data source options, click **Save & test** at the bottom to test out your data source connection. You can also remove a connection by clicking **Delete**.
