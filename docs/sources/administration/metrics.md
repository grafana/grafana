+++
title = "Internal Grafana metrics"
description = "Internal metrics exposed by Grafana"
keywords = ["grafana", "metrics", "internal metrics"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++

# Internal Grafana metrics

Grafana collects some metrics about itself internally. Grafana supports pushing metrics to Graphite or exposing them to be scraped by Prometheus.

For more information about configuration options related to Grafana metrics, refer to [metrics]({{< relref "../installation/configuration/#metrics" >}}) and [metrics.graphite]({{< relref "../installation/configuration/#metrics-graphite" >}}) in [Configuration]({{< relref "../installation/configuration.md" >}}).

## Available metrics

When enabled, Grafana exposes a number of metrics, including:

* Active Grafana instances
* Number of dashboards, users, and playlists
* http status codes
* Requests by routing group
* Grafana active alerts
* Prometheus alerts
* Grafana performance

## View Grafana metrics in Prometheus

These instructions assume you have already added Prometheus as a data source in Grafana.

1. Enable sending metrics to Prometheus. In your configuration file (`grafana.ini` or `custom.ini` depending on your operating system) remove the semicolon to enable the following configuration options: 

   ```
   # Metrics available at HTTP API Url /metrics
   [metrics]
   # Disable / Enable internal metrics
   enabled           = true

   # Disable total stats (stat_totals_*) metrics to be generated
   disable_total_stats = false
   ```

2. (optional) If you want to require authorization to view the metrics endpoint, then uncomment and set the following options:

   ```
   basic_auth_username =
   basic_auth_password =
   ```

3. Restart Grafana. Grafana now sends metrics to http://localhost:3000/metrics.
4. Add the job to your prometheus.yml file.
   Example:

   ```
   - job_name: 'grafana_metrics'

      scrape_interval: 6s
      scrape_timeout: 5s
  
      static_configs:
        - targets: ['localhost:3000']
   ```
5. Restart Prometheus. Your new job should appear on the Targets tab.
6. In Grafana, hover your mouse over the **Configuration** (gear) icon on the left sidebar and then click **Data Sources**.
7. Select the **Prometheus** data source.
8. On the Dashboards tab, **Import** the Grafana metrics dashboard. All scraped Grafana metrics are available in the dashboard.

## View Grafana metrics in Graphite

These instructions assume you have already added Prometheus as a data source in Grafana.

1. Enable sending metrics to Graphite. In your configuration file (`grafana.ini` or `custom.ini` depending on your operating system) remove the semicolon to enable the following configuration options: 

   ```
   # Metrics available at HTTP API Url /metrics
   [metrics]
   # Disable / Enable internal metrics
   enabled           = true

   # Disable total stats (stat_totals_*) metrics to be generated
   disable_total_stats = false
   ```

1. (optional) If you want to require authorization to view the metrics endpoint, then uncomment and set the following options:

   ```
   basic_auth_username =
   basic_auth_password =
   ```

1. Enable [metrics.graphite] options:
   ```
   # Send internal metrics to Graphite
   [metrics.graphite]
   # Enable by setting the address setting (ex localhost:2003)
   address = <hostname or ip>:<port#>
   prefix = prod.grafana.%(instance_name)s.
   ```

1. Restart Grafana. Grafana now sends metrics to http://localhost:3000/metrics and to Graphite.
