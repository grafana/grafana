---
aliases:
  - ../data-sources/elasticsearch/
  - ../features/datasources/elasticsearch/
description: Guide for using Elasticsearch in Grafana
keywords:
  - grafana
  - elasticsearch
  - guide
menuTitle: Elasticsearch
title: Elasticsearch data source
weight: 325
---

# Elasticsearch data source

Grafana ships with built-in support for Elasticsearch.
You can make many types of queries to visualize logs or metrics stored in Elasticsearch, and annotate graphs with log events stored in Elasticsearch.

This topic explains configuring and querying specific to the Elasticsearch data source.
For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../panels-visualizations/query-transform-data" >}}).

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

Once you've added the Elasticsearch data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor/" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}) and use [Explore]({{< relref "../../explore" >}}).

## Supported Elasticsearch versions

This data source supports these versions of Elasticsearch:

- v7.16+
- v8.x

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Elasticsearch` in the search bar.
1. Click **Elasticsearch**.

   The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options:

   | Name        | Description                                                                |
   | ----------- | -------------------------------------------------------------------------- |
   | **Name**    | Sets the name you use to refer to the data source in panels and queries.   |
   | **Default** | Sets the data source that's pre-selected for new panels.                   |
   | **Url**     | Sets the HTTP protocol, IP, and port of your Elasticsearch server.         |
   | **Access**  | Don't modify Access. Use `Server (default)` or the data source won't work. |

You must also configure settings specific to the Elasticsearch data source. These options are described in the sections below.

### Index settings

{{< figure src="/static/img/docs/elasticsearch/elasticsearch-ds-details-7-4.png" max-width="500px" class="docs-image--right" caption="Elasticsearch data source details" >}}

Use the index settings to specify a default for the `time field` and your Elasticsearch index's name.
You can use a time pattern, such as `YYYY.MM.DD`, or a wildcard for the index name.

### Configure Min time interval

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

We recommend setting this value to match your Elasticsearch write frequency.
For example, set this to `1m` if Elasticsearch writes data every minute.

You can also override this setting in a dashboard panel under its data source options.

### X-Pack enabled

Toggle this to enable `X-Pack`-specific features and options, which provide the [query editor]({{< relref "./query-editor/" >}}) with additional aggregations, such as `Rate` and `Top Metrics`.

#### Include frozen indices

When the "X-Pack enabled" setting is active and the configured Elasticsearch version is higher than `6.6.0`, you can configure Grafana to not ignore [frozen indices](https://www.elastic.co/guide/en/elasticsearch/reference/7.13/frozen-indices.html) when performing search requests.

> **Note:** Frozen indices are [deprecated in Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/frozen-indices.html) since v7.14.

### Logs

You can optionally configure the two Logs parameters **Message field name** and **Level field name** to determine which fields the data source uses for log messages and log levels when visualizing logs in [Explore]({{< relref "../../explore/" >}}).

For example, if you're using a default setup of Filebeat for shipping logs to Elasticsearch, set:

- **Message field name:** `message`
- **Level field name:** `fields.level`

### Data links

Data links create a link from a specified field that can be accessed in Explore's logs view.

Each data link configuration consists of:

| Parameter         | Description                                                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Field**         | Sets the name of the field used by the data link.                                                                                                                                                                                   |
| **URL/query**     | Sets the full link URL if the link is external. If the link is internal, this input serves as a query for the target data source.<br/>In both cases, you can interpolate the value from the field with the `${__value.raw }` macro. |
| **URL Label**     | (Optional) Sets a custom display label for the link. The link label defaults to the full external URL or name of the linked internal data source and is overridden by this setting.                                                 |
| **Internal link** | Sets whether the link is internal or external. For an internal link, you can select the target data source with a data source selector. This supports only tracing data sources.                                                    |

### Configure Amazon Elasticsearch Service

If you use Amazon Elasticsearch Service, you can use Grafana's Elasticsearch data source to visualize data from it.

If you use an AWS Identity and Access Management (IAM) policy to control access to your Amazon Elasticsearch Service domain, you must use AWS Signature Version 4 (AWS SigV4) to sign all requests to that domain.

For details on AWS SigV4, refer to the [AWS documentation](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html).

#### AWS Signature Version 4 authentication

> **Note:** Available in Grafana v7.3 and higher.

To sign requests to your Amazon Elasticsearch Service domain, you can enable SigV4 in Grafana's [configuration]({{< relref "../../setup-grafana/configure-grafana/#sigv4_auth_enabled" >}}).

Once AWS SigV4 is enabled, you can configure it on the Elasticsearch data source configuration page.
For more information about AWS authentication options, refer to [AWS authentication]({{< relref "../aws-cloudwatch/aws-authentication/" >}}).

{{< figure src="/static/img/docs/v73/elasticsearch-sigv4-config-editor.png" max-width="500px" class="docs-image--no-shadow" caption="SigV4 configuration for AWS Elasticsearch Service" >}}

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

> **Note:** The previously used `database` field has now been [deprecated](https://github.com/grafana/grafana/pull/58647).
> You should now use the `index` field in `jsonData` to store the index name.
> Please see the examples below.

#### Provisioning examples

**Basic provisioning:**

```yaml
apiVersion: 1

datasources:
  - name: Elastic
    type: elasticsearch
    access: proxy
    url: http://localhost:9200
    jsonData:
      index: '[metrics-]YYYY.MM.DD'
      interval: Daily
      timeField: '@timestamp'
```

**Provision for logs:**

```yaml
apiVersion: 1

datasources:
  - name: elasticsearch-v7-filebeat
    type: elasticsearch
    access: proxy
    url: http://localhost:9200
    jsonData:
      index: '[filebeat-]YYYY.MM.DD'
      interval: Daily
      timeField: '@timestamp'
      logMessageField: message
      logLevelField: fields.level
      dataLinks:
        - datasourceUid: my_jaeger_uid # Target UID needs to be known
          field: traceID
          url: '$${__value.raw}' # Careful about the double "$$" because of env var expansion
```

## Query the data source

You can select multiple metrics and group by multiple terms or filters when using the Elasticsearch query editor.

For details, see the [query editor documentation]({{< relref "./query-editor/" >}}).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation]({{< relref "./template-variables/" >}}).
