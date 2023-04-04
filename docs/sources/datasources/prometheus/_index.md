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

To configure basic settings for the data source, complete the following steps:

1.  Click **Connections** in the left-side menu.
1.  Under Your connections, click **Data sources**.
1.  Enter `Prometheus` in the search bar.
1.  Select **Prometheus**.

    The **Settings** tab of the data source is displayed.

1.  Set the data source's basic configuration options:

        | Name                            | Description                                                                                                                                                                                                                                                                                                     |

    | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `Name` | The data source name. This is how you refer to the data source in panels and queries. |
    | `Default` | Default data source that is pre-selected for new panels. |
    | `URL` | The URL of your Prometheus server, for example, `http://prometheus.example.org:9090`. |
    | `Access` | Only Server access mode is functional. If Server mode is already selected this option is hidden. Otherwise change to Server mode to prevent errors. |
    | `Basic Auth` | Enable basic authentication to the Prometheus data source. |
    | `User` | User name for basic authentication. |
    | `Password` | Password for basic authentication. |
    | `Manage alerts via Alerting UI` | Toggle whether to enable Alertmanager integration for this data source. |
    | `Scrape interval` | Set this to the typical scrape and evaluation interval configured in Prometheus. Defaults to 15s. |
    | `HTTP method` | Use either POST or GET HTTP method to query your data source. POST is the recommended and pre-selected method as it allows bigger queries. Change this to GET if you have a Prometheus version older than 2.1 or if POST requests are restricted in your network. |
    | `Type` | The type of your Prometheus server; `Prometheus`, `Cortex`, `Thanos`, `Mimir`. When selected, the **Version** field attempts to populate automatically using the Prometheus [buildinfo](https://semver.org/) API. Some Prometheus types, such as Cortex, don't support this API and must be manually populated. |
    | `Version` | The version of your Prometheus server, note that this field is not visible until the Prometheus type is selected. |
    | `Disable metrics lookup` | Checking this option will disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with bigger Prometheus instances. |
    | `Custom query parameters` | Add custom parameters to the Prometheus query URL. For example `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Multiple parameters should be concatenated together with an '&amp;'. |
    | **Exemplars configuration** | |
    | `Internal link` | Enable this option is you have an internal link. When you enable this option, you will see a data source selector. Select the backend tracing data store for your exemplar data. |
    | `Data source` | You will see this option only if you enable `Internal link` option. Select the backend tracing data store for your exemplar data. |
    | `URL` | You will see this option only if the `Internal link` option is disabled. Enter the full URL of the external link. You can interpolate the value from the field with `${__value.raw }` macro. |
    | `URL Label` | (Optional) add a custom display label to override the value of the `Label name` field. |
    | `Label name` | Add a name for the exemplar traceID property. |

        **Exemplars configuration:**

        | Name              | Description                                                                                                                                                                                                                                                    |

    | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | **Internal link** | Enable this option if you have an internal link. When enabled, this reveals the data source selector. Select the backend tracing data store for your exemplar data. |
    | **Data source** | _(Visible only if you enable `Internal link`)_ Selects the backend tracing data store for your exemplar data. |
    | **URL** | _(Visible only if you disable `Internal link`)_ Defines the external link's full URL. You can interpolate the value from the field by using the [`${__value.raw}` macro]({{< relref "../..//panels-visualizations/configure-data-links/#value-variables" >}}). |
    | **URL label** | _(Optional)_ Adds a custom display label to override the value of the `Label name` field. |
    | **Label name** | Adds a name for the exemplar traceID property. |

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
      manageAlerts: true
      prometheusType: Prometheus
      prometheusVersion: 2.37.0
      cacheLevel: 'High'
      incrementalQuerying: true
      incrementalQueryOverlapWindow: 10m
      exemplarTraceIdDestinations:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          name: traceID

        # Field with external link.
        - name: traceID
          url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Jaeger%22,%7B%22query%22:%22$${__value.raw}%22%7D%5D'
```

## Query the data source

The Prometheus query editor includes a code editor and visual query builder.

For details, see the [query editor documentation]({{< relref "./query-editor" >}}).

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

## Incremental Dashboard Queries (beta)

As of Grafana 10, data sources can be configured to query live dashboards incrementally, instead of re-querying the entire duration on each dashboard refresh.
This can be toggled on or off in the datasource configuration or provisioning file (under `incrementalQuerying` in jsonData).
Additionally, the amount of overlap between incremental queries can be configured using the `incrementalQueryOverlapWindow` jsonData field, the default value is 10m (10 minutes).

Increasing the duration of the `incrementalQueryOverlapWindow` will increase the size of every incremental query, but might be helpful for instances that have inconsistent results for recent data.
