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
---

# Configure Prometheus

Grafana ships with built-in support for Prometheus. If you are new to Prometheus the following documentation will help you get started working with Prometheus and Grafana:

- [What is Prometheus?](ref:intro-to-prometheus)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Getting started](https://prometheus.io/docs/prometheus/latest/getting_started/)

## Configure the data source

{{< shared id="add-prom-data-source" >}}

To add the Prometheus data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under **Connections**, click **Add new connection**.
1. Enter `Prometheus` in the search bar.
1. Click **Prometheus data source**.
1. Click **Add new data source** in the upper right.
1. Enter a name for the data source.

{{< /shared >}}

You will be taken to the **Settings** tab where you will set up your Prometheus configuration.

## Configuration options

The following is a list of configuration options for Prometheus.

The first option to configure is the name of your connection:

- **Name** - The data source name. This is how you refer to the data source in panels and queries. Examples: prometheus-1, prom-metrics.

- **Default** - Toggle to select as the default name in dashboard panels. When you go to a dashboard panel this will be the default selected data source.

### Connection section

- **Prometheus server URL** - The URL of your Prometheus server. {{< shared id="prom-data-source-url" >}}
  If your Prometheus server is local, use `http://localhost:9090`. If it's on a server within a network, this is the URL with the port where you are running Prometheus. Example: `http://prometheus.example.orgname:9090`.

{{< admonition type="note" >}}

If you're running Grafana and Prometheus together in different container environments, each localhost refers to its own container - if the server URL is localhost:9090, that means port 9090 inside the Grafana container, not port 9090 on the host machine.

You should use the IP address of the Prometheus container, or the hostname if you are using Docker Compose. Alternatively, you can consider `http://host.docker.internal:9090`.

{{< /admonition >}}

{{< /shared >}}

### Authentication section

There are several authentication methods you can choose in the Authentication section.

{{% admonition type="note" %}}

Use TLS (Transport Layer Security) for an additional layer of security when working with Prometheus. For information on setting up TLS encryption with Prometheus see [Securing Prometheus API and UI Endpoints Using TLS Encryption](https://prometheus.io/docs/guides/tls-encryption/). You must add TLS settings to your Prometheus configuration file **prior** to setting these options in Grafana.

{{% /admonition %}}

- **Basic authentication** - The most common authentication method. Use your `data source` user name and `data source` password to connect.

- **With credentials** - Toggle on to enable credentials such as cookies or auth headers to be sent with cross-site requests.

- **TLS client authentication** - Toggle on to use client authentication. When enabled, add the `Server name`, `Client cert` and `Client key`. The client provides a certificate that is validated by the server to establish the client's trusted identity. The client key encrypts the data between client and server.

- **With CA cert** - Authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file.

- **Skip TLS verify** - Toggle on to bypass TLS certificate validation.

- **Forward OAuth identity** - Forward the OAuth access token (and also the OIDC ID token if available) of the user querying the data source.

### Custom HTTP headers

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Prometheus instance.

- **Value** - The value of the header.

## Advanced settings

Following are additional configuration options.

### Advanced HTTP settings

- **Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.

- **Timeout** - The HTTP request timeout. This must be in seconds. The default is 30 seconds.

### Alerting

- **Manage alerts via Alerting UI** - Toggle to enable [data source-managed rules in Grafana Alerting](ref:alerting-alert-rules) for this data source. For `Mimir`, it enables managing data source-managed rules and alerts. For `Prometheus`, it only supports viewing existing rules and alerts, which are displayed as data source-managed.

{{% admonition type="note" %}}

The **Manage alerts via Alerting UI** toggle is enabled by default. You can change this behavior by setting the [default_manage_alerts_ui_toggle]({{< relref "../../setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle" >}}) option in the Grafana configuration file.

{{% /admonition %}}

### Interval behavior

- **Scrape interval** - Set to the typical scrape and evaluation interval configured in Prometheus. The default is `15s`.

- **Query timeout** - The default is `60s`.

### Query editor

- **Default editor** - Sets a default editor. Options are `Builder` or `Code`. For information on query editor types see [Prometheus query editor]({{< relref "./query-editor" >}}).

- **Disable metrics lookup** - Toggle on to disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with large Prometheus instances.

### Performance

- **Prometheus type** - The type of your Prometheus server. There are four options: `Prometheus`, `Cortex`, `Mimir`, and `Thanos`.

- **Cache level** - The browser caching level for editor queries. There are four options: `Low`, `Medium`, `High`, or `None`.

- **Incremental querying (beta)** - Changes the default behavior of relative queries to always request fresh data from the Prometheus instance. Enable this option to decrease database and network load.

- **Disable recording rules (beta)** - Toggle on to disable the recording rules. Enable this option to improve dashboard performance.

### Other

- **Custom query parameters** - Add custom parameters to the Prometheus query URL. For example `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Multiple parameters should be concatenated together with an '&amp;'.

- **HTTP method** - Use either `POST` or `GET` HTTP method to query your data source. `POST` is the recommended and pre-selected method as it allows bigger queries. Change to `GET` if you have a Prometheus version older than 2.1 or if `POST` requests are restricted in your network.

### Exemplars

Support for exemplars is available only for the Prometheus data source. If this is your first time working with exemplars see [Introduction to exemplars](ref:exemplars). An exemplar is a specific trace representative of measurement taken in a given time interval.

- **Internal link** - Toggle on to enable an internal link. When enabled, reveals the data source selector. Select the backend tracing data store for your exemplar data.

- **URL** - _(Visible if you **disable** `Internal link`)_ Defines the external link's URL trace backend. You can interpolate the value from the field by using the [`${__value.raw}` macro](ref:configure-data-links-value-variables).

- **Data source** - _(Visible if you **enable** `Internal link`)_ The data source the exemplar will navigate to.

- **URL label** - Adds a custom display label to override the value of the `Label name` field.

- **Label name** - The name of the field in the `labels` object used to obtain the traceID property.

- **Remove exemplar link** - Click to remove existing links.

### Troubleshooting

Refer to the following troubleshooting information, as required.

#### Data doesn't appear in Explore metrics

<!-- vale Grafana.Spelling = NO -->

If metric data doesn't appear in Explore after you've successfully tested a connection to a Prometheus data source or sent
metrics to Grafana Cloud, ensure that you've selected the correct data source in the **Data source** drop-down menu. If
you've used remote_write to send metrics to Grafana Cloud, the data source name follows the convention
`grafanacloud-stackname-prom`.

<!-- vale Grafana.Spelling = YES -->

The following image shows the **Data source** field in Explore metrics.

![Image that shows Prometheus metrics in Explore](/media/docs/grafana/data-sources/prometheus/troubleshoot-connection-1.png)
