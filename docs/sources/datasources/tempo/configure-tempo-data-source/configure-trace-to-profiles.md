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
aliases:
  - /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#trace-to-profiles
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

You can provision the trace to profiles configuration using the `tracesToProfiles` block in your data source YAML file:

```yaml
jsonData:
  tracesToProfiles:
    datasourceUid: 'grafana-pyroscope-datasource'
    tags: ['job', 'instance', 'pod', 'namespace']
    profileTypeId: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds'
    customQuery: true
    query: 'method="$${__span.tags.method}"'
```

For the full provisioning YAML example including all Tempo settings, refer to [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/).

## Verify the integration

After configuring trace to profiles, verify the integration:

1. Open **Explore** and select your Tempo data source.
1. Run a query to load a trace.
1. Expand a span and confirm that the **Profiles for this span** button appears in the span details.
1. Click the button and verify that an embedded flame graph loads with profiling data.

## Troubleshooting

### Profiles for this span button doesn't appear

- Verify the Tempo data source has a Pyroscope data source selected in **Trace to profiles** > **Data source**.
- Confirm the span includes the `pyroscope.profile.id` attribute. If this attribute is missing, the OpenTelemetry span profiling bridge isn't configured correctly. Refer to [Configure trace span profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/) for setup instructions.
- Check that at least one of the configured tags exists as an attribute on the span. If none of the tags match, Grafana doesn't generate the link.

### Button appears but flame graph is empty

- Confirm the tag values on the span match the labels in Pyroscope. For example, `service.name=checkout` in the span must match a corresponding label in Pyroscope.
- Verify the **Profile type** setting matches the profile type your application emits (for example, `process_cpu`).

### Configuration fields are greyed out

Your data source is provisioned. Refer to the [Provisioning](#provisioning) section for how to update the configuration via YAML.

For additional diagnosis steps, refer to [Troubleshoot trace to profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/) in the Pyroscope documentation.

## Next steps

- [Configure trace to logs correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/) — Navigate from spans to related logs in Loki.
- [Configure trace to metrics correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-metrics/) — Link spans to metrics queries in Prometheus.
- [Provision the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/provision/) — Configure the Tempo data source using a YAML file.
