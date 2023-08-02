---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-alert-state-history/
description: Configure Alert State History
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - alert state history
labels:
  products:
    - cloud
title: Configure Alert State History
weight: 600
---

# Configure Alert State History

{{% admonition type="note" %}}
This applies to Open Source only. There is no configuration required if you are using Grafana Cloud.
{{% /admonition %}}

Starting with Grafana 10, Alerting can record all alert rule state changes for your Grafana managed alert rules in a Loki instance.

This allows you to explore the behavior of your alert rules in the Grafana explore view and levels up the existing state history modal with a powerful new visualisation.

<!-- image here, maybe the one from the blog? -->

## Configuring Loki

To set up alert state history, make sure to have a Loki instance Grafana can write data to. The default settings might need some tweaking as the state history modal might query up to 30 days of data.

The following change to the default configuration should work for most instances, but we recommend looking at the full Loki configuration settings and adjust according to your needs.

As this might impact the performances of an existing Loki instance, we recommend using a separate Loki instance for the alert state history.

```yaml
limits_config:
  split_queries_by_interval: '24h'
  max_query_parallelism: 32
```

## Configuring Grafana

We need some additional configuration in the Grafana configuration file to have it working with the alert state history.

The example below instructs Grafana to write alert state history to a local Loki instance:

```toml
[unified_alerting.state_history]
enabled = true
backend = "loki"
loki_remote_url = "http://localhost:3100"

[feature_toggles]
enable = alertStateHistoryLokiSecondary, alertStateHistoryLokiPrimary, alertStateHistoryLokiOnly
```

<!-- TODO can we add some more info here about the feature flags and the various different supported setups with Loki as Primary / Secondary, etc? -->

## Adding the Loki data source

See our instructions on [adding a data source](/docs/grafana/latest/administration/data-source-management/).

## Querying the history

If everything is set up correctly you can use the Grafana Explore view to start querying the Loki data source.

A simple litmus test to see if data is being written correctly into the Loki instance is the following query:

```logQL
{ from="state-history" } | json
```
