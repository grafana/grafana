---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for configuring Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure Prometheus
title: Configure the Prometheus data source
weight: 200
refs:
  intro-to-prometheus:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/
  exemplars:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  configure-data-links-value-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#value-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#value-variables
  alerting-alert-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/
  add-a-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
  prom-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor
  default-manage-alerts-ui-toggle:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle
---

# Configure the Prometheus data source

This document provides instructions for configuring the Prometheus data source and explains the available configuration options. Grafana ships with built-in support for Prometheus, so there's no need to install a plugin. For general information on adding a data source to Grafana, refer to [Add a data source](ref:add-a-data-source).

## Before you begin

- You must have the `Organization administrator` role to add a data source. Administrators can also configure a data source via [YAML with the Grafana provisioning system](https://grafana.com//docs/plugins/grafana-mongodb-datasource/<GRAFANA_VERSION>/#provision-the-mongodb-data-source).

- Know which Prometheus-compatible database you are using.

- Familiarize yourself with your Prometheus security configuration and gather any necessary security certificates and client keys.

- Verify that data from Prometheus is being written to your Grafana instance.

## Configure the data source using the UI

{{< shared id="add-prom-data-source" >}}

To add the Prometheus data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under **Connections**, click **Add new connection**.
1. Enter `Prometheus` in the search bar.
1. Click **Prometheus data source**.
1. Click **Add new data source** in the upper right.

{{< /shared >}}

You are taken to the **Settings** tab where you will set up your Prometheus configuration.

## Configuration options

Following is a list of configuration options for Prometheus.

- **Name** - The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: prometheus-1, prom-metrics.

- **Default** - Toggle to select as the default name in dashboard panels. When you go to a dashboard panel this will be the default selected data source.

**Connection:**

- **Prometheus server URL** - The URL of your Prometheus server. {{< shared id="prom-data-source-url" >}}
  If Prometheus is running locally, use `http://localhost:9090`. If it's hosted on a networked server, provide the server’s URL along with the port where Prometheus is running. Example: `http://prometheus.example.orgname:9090`.

{{< admonition type="note" >}}
When running Grafana and Prometheus in separate containers, localhost refers to each container’s own network namespace. This means that `localhost:9090` points to port 9090 inside the Grafana container, not on the host machine.

You should use the IP address of the Prometheus container, or the hostname if you are using Docker Compose. Alternatively, you can use `http://host.docker.internal:9090` to reference the host machine.
{{< /admonition >}}

{{< /shared >}}

**Authentication:**

There are three authentication option for the Prometheus data source.

- **Basic authentication** - The most common authentication method.

  - **User** - The username you use to connect to the data source.
  - **Password** - The password you use to connect to the data source.

- **Forward OAuth identity** - Forward the OAuth access token (and also the OIDC ID token if available) of the user querying the data source.

- **No authentication** - Allows access to the data source without any authentication.

**TLS settings:**

{{< admonition type="note" >}}
Use TLS (Transport Layer Security) for an additional layer of security when working with Prometheus. For information on setting up TLS encryption with Prometheus see [Securing Prometheus API and UI Endpoints Using TLS Encryption](https://prometheus.io/docs/guides/tls-encryption/). You must add TLS settings to your Prometheus configuration file **prior** to setting these options in Grafana.
{{< /admonition >}}

- **Add self-signed certificate** - Check the box to ass a self-signed certificate.
  \_ **CA certificate** - Add your certificate.
- **TLS client authentication** - Check the box to enable TLS client authentication.
  - **Server name** -
  - **Client certificate** - The client certificate is generated from a Certificate Authority or it's self-signed. Follow the instructions of the CA (Certificate Authority) to download the certificate file.
  - **Client key** - The client provides a certificate that is validated by the server to establish the client's trusted identity. The client key encrypts the data between client and server.
- **Skip TLS verify** - Toggle on to bypass TLS certificate validation.

**HTTP headers:**

Pass along additional information and metadata about the request or response.

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Prometheus instance.
- **Value** - The value of the header.

**Advanced settings:**

Following are optional configuration settings you can configure for more control over your data source.

- **Advanced HTTP settings:**
  - **Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.
  - **Timeout** - The HTTP request timeout. This must be in seconds. The default is 30 seconds.

**Alerting:**

- **Manage alerts via Alerting UI** -Toggled on by default. This enables [data source-managed rules in Grafana Alerting](ref:alerting-alert-rules) for this data source. For `Mimir`, it enables managing data source-managed rules and alerts. For `Prometheus`, it only supports viewing existing rules and alerts, which are displayed as data source-managed. Change this by setting the [`default_manage_alerts_ui_toggle`](../../../setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle) option in the Grafana configuration file.

**Interval behavior:**

- **Scrape interval** - Sets the standard scrape and evaluation interval in Prometheus. The default is `15s`. This interval determines how often Prometheus scrapes targets. Set it to match the typical scrape and evaluation interval in your Prometheus configuration file. If you set a higher value than your Prometheus configuration, Grafana will evaluate data at this interval, resulting in fewer data points.
- **Query timeout** - Sets the Prometheus query timeout. The default is `60s`. Without a timeout, complex or inefficient queries can run indefinitely, consuming CPU and memory resources.

**Query editor:**

- **Default editor** - Sets the default query editor. Options are `Builder` or `Code`. `Builder` mode helps you build queries using a visual interface. `Code` mode is geared for the experienced Prometheus user with prior expertise in PromQL. For more details on editor types refer to [Prometheus query editor](ref:prom-query-editor).
- **Disable metrics lookup** - Toggle on to disable the metrics chooser and metric and label support in the query field's autocomplete. This can improve performance for large Prometheus instances.

**Performance:**

- **Prometheus type** - Select the type of your Prometheus-compatible database, such as Prometheus, Cortex, Mimir, or Thanos. Changing this setting will save your current configuration. Different database types support different APIs. For example, some allow `regex` matching for label queries to improve performance, while others provide a metadata API. Setting this incorrectly may cause unexpected behavior when querying metrics and labels. Refer to your Prometheus documentation to ensure you select the correct type.
- **Cache level** - Sets the browser caching level for editor queries. There are four options: `Low`, `Medium`, `High`, or `None`. Higher cache settings are recommended for high cardinality data sources.
- **Incremental querying (beta)** - Toggle on to enable incremental querying. Enabling this feature changes the default behavior of relative queries. Instead of always requesting fresh data from the Prometheus instance, Grafana will cache query results and only fetch new records. This helps reduce database and network load.
  - **Query overlap window** - If you are using incremental querying, specify a duration (e.g., 10m, 120s, or 0s). The default is `10m`. This is a buffer of time added to incremental queries This value is added to the duration of each incremental request.
- **Disable recording rules (beta)** - Toggle to disable the recording rules. Enable this option to improve dashboard performance.

**Other settings:**

- **Custom query parameters** - Add custom parameters to the Prometheus query URL, which allow for more control over how queries are executed. Examples: `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Multiple parameters should be joined using `&`. 
- **HTTP method** - Select either the `POST` or `GET` HTTP method to query your data source. `POST`is recommended and selected by default, as it supports larger queries. Select `GET` if you're using Prometheus version 2.1 or older, or if your network restricts `POST` requests.
Toggle on 
- **Use series endpoint** - Enabling this option makes Grafana use the series endpoint (/api/v1/series) with the match[] parameter instead of the label values endpoint (/api/v1/label/<label_name>/values). While the label values endpoint is generally more performant, some users may prefer the series endpoint because it supports the `POST` method, whereas the label values endpoint only allows `GET` requests.


 <!-- Checking this option will favor the series endpoint with match[] parameter over the label values endpoint with match[] parameter. While the label values endpoint is considered more performant, some users may prefer the series because it has a POST method while the label values endpoint only has a GET method. Visit docs for more details here. -->

**Exemplars:**

Support for exemplars is available only for the Prometheus data source. For more information on exemplars refer to [Introduction to exemplars](ref:exemplars). An exemplar is a trace that represents a specific measurement taken within a given time interval.

Click the **+ sign** to add exemplars.

- **Internal link** - Toggle on to enable an internal link. This will display the data source selector, where you can choose the backend tracing data store for your exemplar data.
- **URL** - _(Visible if you **disable** `Internal link`)_ Defines the external link's URL trace backend. You can interpolate the value from the field by using the [`${__value.raw}` macro](ref:configure-data-links-value-variables).
- **Data source** - _(Visible when`Internal link` is enabled.)_ Select the data source that the exemplar will link to from the drop-down.
- **URL label** - Adds a custom display label to override the value of the `Label name` field.
- **Label name** - The name of the field in the `labels` object used to obtain the traceID property.
- **Remove exemplar link** - Click the **X** to remove existing links.

You can add multiple exemplars.

- **Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc) for steps on setting up a PDC connection.

Click **Manage private data source connect** to be taken to your PDC connection page, where you’ll find your PDC configuration details.

Once you have configured your MongDB data source options, click **Save & test** at the bottom to test out your data source connection. 

You should see a confirmation dialog box that says **what's the success message**.

You can also remove a connection by clicking **Delete**.

## Provision the Prometheus data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

{{< admonition type="note" >}}
Once you have provisioned a data source you cannot edit it.
{{< /admonition >}}

### Provisioning example

<!-- ```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    # Access mode - proxy (server in the UI) or direct (browser in the UI).
    url: http://localhost:9090
    jsonData:
      httpMethod: POST
      manageAlerts: true
      prometheusType: Prometheus
      prometheusVersion: 2.44.0
      cacheLevel: 'High'
      disableRecordingRules: false
      incrementalQueryOverlapWindow: 10m
      exemplarTraceIdDestinations:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          name: traceID

        # Field with external link.
        - name: traceID
          url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Jaeger%22,%7B%22query%22:%22$${__value.raw}%22%7D%5D'
``` -->

Example of a Prometheus data source configuration:

    ```yaml
    apiVersion: 1

    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        # Access mode - proxy (server in the UI) or direct (browser in the UI).
        url: http://localhost:9090
        jsonData:
          httpMethod: POST
          manageAlerts: true
          prometheusType: Prometheus
          prometheusVersion: 2.44.0
          cacheLevel: 'High'
          disableRecordingRules: false
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

## Recording rules (beta)

The Prometheus data source can be configured to disable recording rules under the data source configuration or provisioning file (under `disableRecordingRules` in jsonData).

## Troubleshooting

Refer to the following troubleshooting information, as required.

**Data doesn't appear in Explore metrics:**

<!-- vale Grafana.Spelling = NO -->

<!-- If metric data doesn't appear in Explore after you've successfully tested a connection to a Prometheus data source or sent
metrics to Grafana Cloud, ensure that you've selected the correct data source in the **Data source** drop-down menu. If
you've used remote_write to send metrics to Grafana Cloud, the data source name follows the convention
`grafanacloud-stackname-prom`. -->

If you have successfully tested the connection to a Prometheus data source or are sending metrics to Grafana Cloud and there is no metric data appearing in Explore, make sure you've selected the correct data source from the data source drop-down menu. When using `remote_write` to send metrics to Grafana Cloud, the data source name follows the convention `grafanacloud-stackname-prom`.


<!-- If metric data doesn't appear in Explore after successfully testing the connection to a Prometheus data source or sending metrics to Grafana Cloud, make sure you've selected the correct data source from the Data Source drop-down menu. When using remote_write to send metrics to Grafana Cloud, the data source name follows the convention grafanacloud-stackname-prom." -->

<!-- vale Grafana.Spelling = YES -->

The following image shows the **Data source** field in Explore metrics.

![Image that shows Prometheus metrics in Explore](/media/docs/grafana/data-sources/prometheus/troubleshoot-connection-1.png)
