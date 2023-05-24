---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for using Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
menuTitle: Prometheus
title: Prometheus data source
weight: 1300
---

# Prometheus data source

Grafana ships with built-in support for Prometheus.
This topic explains options, variables, querying, and other features specific to the Prometheus data source, which include its [feature-rich code editor for queries and visual query builder]({{< relref "./query-editor/" >}}).

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

Once you've added the data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor/" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}), use [Explore]({{< relref "../../explore/" >}}), and [annotate visualizations]({{< relref "./query-editor/#apply-annotations" >}}).

## Prometheus API

The Prometheus data source also works with other projects that implement the [Prometheus querying API](https://prometheus.io/docs/prometheus/latest/querying/api/).

For more information on how to query other Prometheus-compatible projects from Grafana, refer to the specific project's documentation:

- [Grafana Mimir](/docs/mimir/latest/)
- [Thanos](https://thanos.io/tip/components/query.md/)

## Configure the data source

**To access the data source configuration page:**

1. Hover the cursor over the **Configuration** (gear) icon.
1. Select **Data Sources**.
1. Select the Prometheus data source.

Set the data source's basic configuration options carefully:

| Name                        | Description                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                    | Sets the name you use to refer to the data source in panels and queries.                                                                                                                                                                                                                                                                                       |
| **Default**                 | Sets whether the data source is pre-selected for new panels.                                                                                                                                                                                                                                                                                                   |
| **Url**                     | Sets the URL of your Prometheus server, such as `http://prometheus.example.org:9090`.                                                                                                                                                                                                                                                                          |
| **Access**                  | Only Server access mode is functional. If Server mode is already selected, this option is hidden. Otherwise, change this to Server mode to prevent errors.                                                                                                                                                                                                     |
| **Basic Auth**              | Enables basic authentication to the Prometheus data source.                                                                                                                                                                                                                                                                                                    |
| **User**                    | Sets the user name for basic authentication.                                                                                                                                                                                                                                                                                                                   |
| **Password**                | Sets the password for basic authentication.                                                                                                                                                                                                                                                                                                                    |
| **Scrape interval**         | Sets the scrape and evaluation interval. We recommend the same value as the typical configured in Prometheus. Defaults to 15s.                                                                                                                                                                                                                                 |
| **Type**                    | Defines the type of your Prometheus server. Valid values are `Prometheus`, `Cortex`, `Thanos`, `Mimir`. When selected, the Prometheus version field attempts to detect the version automatically using the Prometheus [buildinfo](https://semver.org/) API. Some Prometheus types, such as Cortex, don't support this API, and you must provide their version. |
| **Version**                 | Defines the version of your Prometheus server. This field is visible only after the **Type** field is defined.                                                                                                                                                                                                                                                 |
| **HTTP method**             | Sets the HTTP method used to query your data source. We recommend POST, which is pre-selected, because it allows for larger queries. Use GET if the Prometheus version is older than 2.1, or if POST requests are restricted in your network.                                                                                                                  |
| **Disable metrics lookup**  | Disables the metrics chooser and metric/label support in the query field's autocompletion. This can prevent performance issues with larger Prometheus instances.                                                                                                                                                                                               |
| **Custom query parameters** | Adds custom parameters to the Prometheus query URL, such as `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Concatenate multiple parameters with '&amp;'.                                                                                                                                                                                  |

**Exemplars configuration:**

| Name              | Description                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Internal link** | Enable this option if you have an internal link. When enabled, this reveals the data source selector. Select the backend tracing data store for your exemplar data.                                                                                            |
| **Data source**   | _(Visible only if you enable `Internal link`)_ Selects the backend tracing data store for your exemplar data.                                                                                                                                                  |
| **URL**           | _(Visible only if you disable `Internal link`)_ Defines the external link's full URL. You can interpolate the value from the field by using the [`${__value.raw}` macro]({{< relref "../..//panels-visualizations/configure-data-links/#value-variables" >}}). |
| **URL label**     | _(Optional)_ Adds a custom display label to override the value of the `Label name` field.                                                                                                                                                                      |
| **Label name**    | Adds a name for the exemplar traceID property.                                                                                                                                                                                                                 |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

#### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    # Access mode - proxy (server in the UI) or direct (browser in the UI).
    access: proxy
    url: http://localhost:9090
    jsonData:
      httpMethod: POST
      exemplarTraceIdDestinations:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          name: traceID

        # Field with external link.
        - name: traceID
          url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Jaeger%22,%7B%22query%22:%22$${__value.raw}%22%7D%5D'
```

## View Grafana metrics with Prometheus

Grafana exposes metrics for Prometheus on the `/metrics` endpoint.
We also bundle a dashboard within Grafana so you can start viewing your metrics faster.

**To import the bundled dashboard:**

1. Navigate to the data source's [configuration page]({{< relref "#configure-the-data-source" >}}).
1. Select the **Dashboards** tab.

   This displays dashboards for Grafana and Prometheus.

1. Select **Import** for the dashboard to import.

For details about these metrics, refer to [Internal Grafana metrics]({{< relref "../../setup-grafana/set-up-grafana-monitoring/" >}}).

### Amazon Managed Service for Prometheus

The Prometheus data source works with Amazon Managed Service for Prometheus.

If you use an AWS Identity and Access Management (IAM) policy to control access to your Amazon Elasticsearch Service domain, you must use AWS Signature Version 4 (AWS SigV4) to sign all requests to that domain.

For details on AWS SigV4, refer to the [AWS documentation](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html).

#### AWS Signature Version 4 authentication

> **Note:** Available in Grafana v7.3.5 and higher.

To connect the Prometheus data source to Amazon Managed Service for Prometheus using SigV4 authentication, refer to the AWS guide to [Set up Grafana open source or Grafana Enterprise for use with AMP](https://docs.aws.amazon.com/prometheus/latest/userguide/AMP-onboard-query-standalone-grafana.html).

If you run Grafana in an Amazon EKS cluster, follow the AWS guide to [Query using Grafana running in an Amazon EKS cluster](https://docs.aws.amazon.com/prometheus/latest/userguide/AMP-onboard-query-grafana-7.3.html).

### Configure exemplars

> **Note:** Available in Prometheus v2.26 and higher with Grafana v7.4 and higher.

Grafana 7.4 and higher can show exemplars data alongside a metric both in Explore and in Dashboards.
Exemplars associate higher-cardinality metadata from a specific event with traditional time series data.

{{< figure src="/static/img/docs/v74/exemplars.png" class="docs-image--no-shadow" caption="Screenshot showing the detail window of an Exemplar" >}}

Configure Exemplars in the data source settings by adding external or internal links.

{{< figure src="/static/img/docs/v74/exemplars-setting.png" class="docs-image--no-shadow" caption="Screenshot of the Exemplars configuration" >}}

## Query the data source

You can create queries with the Prometheus data source's query editor.

For details, refer to the [query editor documentation]({{< relref "./query-editor/" >}}).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation]({{< relref "./template-variables/" >}}).
