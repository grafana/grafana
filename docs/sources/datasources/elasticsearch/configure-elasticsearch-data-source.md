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
---

# Configure the Elasticsearch data source

Grafana ships with built-in support for Elasticsearch.
You can make many types of queries to visualize logs or metrics stored in Elasticsearch, and annotate graphs with log events stored in Elasticsearch.

For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../panels-visualizations/query-transform-data" >}}).

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

## Configure the data source

To add the Elasticsearch data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under **Connections**, click **Add new connection**.
1. Enter `Elasticsearch` in the search bar.
1. Select **Elasticsearch data source**.
1. Click **Create a Elasticsearch data source** in the upper right.

You will be taken to the **Settings** tab where you will set up your Elasticsearch configuration.

## Configuration options

The following is a list of configuration options for Elasticsearch.

The first option to configure is the name of your connection:

- **Name** - The data source name. This is how you refer to the data source in panels and queries. Examples: elastic-1, elasticsearch_metrics.

- **Default** - Toggle to select as the default data source option. When you go to a dashboard panel or Explore, this will be the default selected data source.

### HTTP section

- **URL** - The URL of your Elasticsearch server. If your Elasticsearch server is local, use `<http://localhost:9200>`. If it is on a server within a network, this is the URL with port where you are running Elasticsearch. Example: `<http://elasticsearch.example.orgname:9200>`.

- **Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.

- **Timeout** - The HTTP request timeout. This must be in seconds. There is no default, so this setting is up to you.

### Auth section

There are several authentication methods you can choose in the Authentication section.

{{% admonition type="note" %}}
Use TLS (Transport Layer Security) for an additional layer of security when working with Elasticsearch. For information on setting up TLS encryption with Elasticsearch see [Configure TLS](https://www.elastic.co/guide/en/elasticsearch/reference/8.8/configuring-tls.html#configuring-tls). You must add TLS settings to your Elasticsearch configuration file **prior** to setting these options in Grafana.
{{% /admonition %}}

- **Basic authentication** - The most common authentication method. Use your `data source` user name and `data source` password to connect.

- **With credentials** - Toggle to enable credentials such as cookies or auth headers to be sent with cross-site requests.

- **TLS client authentication** - Toggle to use client authentication. When enabled, add the `Server name`, `Client cert` and `Client key`. The client provides a certificate that is validated by the server to establish the client's trusted identity. The client key encrypts the data between client and server.

- **With CA cert** - Toggle to authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file.

- **Skip TLS verify** - Toggle on to bypass TLS certificate validation.

- **Forward OAuth identity** - Forward the OAuth access token (and the OIDC ID token if available) of the user querying the data source.

### Custom HTTP headers

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Elasticsearch instance.

- **Value** - The value of the header.

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

- **X-Pack enabled** - Toggle to enable `X-Pack`-specific features and options, which provide the [query editor]({{< relref "./query-editor/" >}}) with additional aggregations, such as `Rate` and `Top Metrics`.

- **Include frozen indices** - Toggle on when the `X-Pack enabled` setting is active. You can configure Grafana to include [frozen indices](https://www.elastic.co/guide/en/elasticsearch/reference/7.13/frozen-indices.html) when performing search requests.

{{% admonition type="note" %}}
Frozen indices are [deprecated in Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/frozen-indices.html) since v7.14.
{{% /admonition %}}

### Logs

In this section you can configure which fields the data source uses for log messages and log levels.

- **Message field name:** - Grabs the actual log message from the default source.

- **Level field name:** - Name of the field with log level/severity information. When a level label is specified, the value of this label is used to determine the log level and update the color of each log line accordingly. If the log doesn’t have a specified level label, we try to determine if its content matches any of the [supported expressions](/docs/grafana/latest/explore/logs-integration/#log-level). The first match always determines the log level. If Grafana cannot infer a log-level field, it will be visualized with an unknown log level.

### Data links

Data links create a link from a specified field that can be accessed in Explore's logs view. You can add multiple data links

Each data link configuration consists of:

- **Field** - Sets the name of the field used by the data link.

- **URL/query** - Sets the full link URL if the link is external. If the link is internal, this input serves as a query for the target data source.<br/>In both cases, you can interpolate the value from the field with the `${__value.raw }` macro.

- **URL Label** (Optional) - Sets a custom display label for the link. The link label defaults to the full external URL or name of the linked internal data source and is overridden by this setting.

- **Internal link** - Toggle on to set an internal link. For an internal link, you can select the target data source with a data source selector. This supports only tracing data sources.
