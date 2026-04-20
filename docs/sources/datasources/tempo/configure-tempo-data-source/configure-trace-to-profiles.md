---
description: Configure trace to profiles to link from Tempo spans to profiling data in Grafana Pyroscope with embedded flame graphs
keywords:
  - grafana
  - tempo
  - guide
  - tracing
  - profiles
  - trace to profiles
  - pyroscope
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Trace to profiles
title: Configure trace to profiles correlation
weight: 500
---

# Configure trace to profiles correlation

Trace to profiles lets you navigate from a span in a trace directly to profiling data in [Grafana Pyroscope](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/). When configured, a **Profiles for this span** button and an embedded flame graph appear in the span details view.

## Before you begin

To configure trace to profiles, you need:

- A [Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) configured in Grafana
- A [Grafana Pyroscope data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/grafana-pyroscope/) configured in Grafana
- An application instrumented with the [OpenTelemetry span profiling bridge](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/) so that spans include the `pyroscope.profile.id` attribute
- Editor or Admin permissions in Grafana

{{< admonition type="note" >}}
You can't modify a provisioned data source from the Grafana UI. If you're using Grafana Cloud Traces (the pre-configured tracing data source in Grafana Cloud), its settings are read-only.
To configure trace to profiles, [clone the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/#clone-a-provisioned-data-source-for-grafana-cloud) to create an editable copy, or update the provisioning file for self-managed instances.
Refer to the [Provisioning](#provisioning) section for details.
{{< /admonition >}}

[//]: # 'Shared content for Trace to profiles in the Tempo data source'

{{< docs/shared source="grafana" lookup="datasources/tempo-traces-to-profiles.md" leveloffset="+1" version="<GRAFANA_VERSION>" >}}

## Provisioning

You can provision the trace to profiles configuration using the `tracesToProfiles` block in your data source YAML file.
For the full provisioning YAML example including all Tempo settings, refer to [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/).

## Verify the integration

After configuring trace to profiles, verify the integration:

1. Open **Explore** and select your Tempo data source.
1. Run a query to load a trace.
1. Expand a span and confirm that the **Profiles for this span** button appears in the span details.
1. Click the button and verify that an embedded flame graph loads with profiling data.

## Troubleshooting

If trace to profiles links aren't appearing or the flame graph is empty, refer to [Trace to logs/metrics/profiles issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/troubleshooting/#trace-to-logsmetricsprofiles-issues) in the troubleshooting guide. For additional diagnosis steps, refer to [Troubleshoot trace to profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/) in the Pyroscope documentation.

If the configuration fields are greyed out, your data source is provisioned. Refer to the [Provisioning](#provisioning) section for how to update the configuration via YAML.

## Next steps

- [Configure trace to logs correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/): Navigate from spans to related logs in Loki.
- [Configure trace to metrics correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-metrics/): Link spans to metrics queries in Prometheus.
- [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/): Configure the Tempo data source using a YAML file.
