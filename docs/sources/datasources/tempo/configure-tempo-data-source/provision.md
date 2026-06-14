---
description: Provision the Tempo data source using a YAML configuration file and clone provisioned data sources in Grafana Cloud
keywords:
  - grafana
  - tempo
  - guide
  - tracing
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Provision
title: Provision the Tempo data source
weight: 800
---

# Provision the Tempo data source

You can define and configure the Tempo data source in YAML files as part of the Grafana provisioning system.

You can use version control, like Git, to track and manage file changes.
Changes can be updated or rolled back as needed.

{{< admonition type="note" >}}
Provisioning via YAML is primarily used for self-managed Grafana instances.
{{< /admonition >}}

For more information about provisioning and available configuration options, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

## Provisioned data sources

You can't modify a provisioned data source from the Grafana UI. The settings form is read-only and the **Save & test** button is replaced by **Test** (you can test the connection but not save changes).

To make changes, you can either:

- **Clone the data source:** Create a new data source of the same type and copy the settings from the provisioned data source. Refer to [Clone a provisioned data source for Grafana Cloud](#clone-a-provisioned-data-source-for-grafana-cloud) for detailed steps.
- **Update the provisioning file:** Edit the YAML configuration file and restart Grafana, or wait for the provisioning system to pick up the change. Any setting, including span time shifts on trace to logs, can be changed by editing the YAML.

## Example file

This example provisioning YAML file sets up the equivalents of the options available in the Tempo data source UI.
Replace `grafana-pyroscope-datasource` with the actual UID of your Pyroscope datasource, and verify the other `datasource Uid` values match what's actually provisioned.

```yaml
apiVersion: 1

datasources:
  - name: Tempo
    type: tempo
    uid: EbPG8fYoz
    url: http://localhost:3200
    access: proxy
    basicAuth: false
    jsonData:
      tracesToLogsV2:
        # Field with an internal link pointing to a logs data source in Grafana.
        # datasourceUid value must match the uid value of the logs data source.
        datasourceUid: 'loki'
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
        tags: [{ key: 'job' }, { key: 'instance' }, { key: 'pod' }, { key: 'namespace' }]
        filterByTraceID: false
        filterBySpanID: false
        customQuery: true
        query: 'method="$${__span.tags.method}"'
      tracesToMetrics:
        datasourceUid: 'prom'
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
        tags: [{ key: 'service.name', value: 'service' }, { key: 'job' }]
        queries:
          - name: 'Sample query'
            query: 'sum(rate(traces_spanmetrics_latency_bucket{$$__tags}[5m]))'
      tracesToProfiles:
        datasourceUid: 'grafana-pyroscope-datasource'
        tags: [{ key: 'job' }, { key: 'instance' }, { key: 'pod' }, { key: 'namespace' }]
        profileTypeId: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds'
        customQuery: true
        query: 'method="$${__span.tags.method}"'
      serviceMap:
        datasourceUid: 'prometheus'
      nodeGraph:
        enabled: true
      search:
        hide: false
      traceQuery:
        timeShiftEnabled: true
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
      spanBar:
        type: 'Tag'
        tag: 'http.path'
      streamingEnabled:
        search: true
        metrics: true
```

For details about individual settings, refer to:

- [Configure trace to logs correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/): `tracesToLogsV2` block
- [Configure trace to metrics correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-metrics/): `tracesToMetrics` block
- [Configure trace to profiles correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-profiles/): `tracesToProfiles` block
- [Additional settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/): `serviceMap`, `nodeGraph`, `search`, `traceQuery`, `spanBar` blocks

## Clone a provisioned data source for Grafana Cloud

If you have a data source that is provisioned by a configuration file in Grafana Cloud, you can clone that provisioned data source and then edit the new data source in the Grafana UI.

For example, if you want to edit the trace to logs settings in your Tempo data source that is provisioned on Grafana Cloud, you can enable traceID and spanID filtering by cloning the data source.

To clone a provisioned data source, follow these steps:

1. Create a viewer [Cloud Access Policy token](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/) in the Grafana Cloud Portal, making sure it has read permissions at least for the data types you are trying to clone.
1. [Create a new data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#add-a-new-data-source) of the same type you want to clone.
1. Copy all of the settings from the existing provisioned data source into the new data source while replacing the password with the API key you created.

   The easiest way to do this is to open separate browser windows with the provisioned data source in one and the newly created data source in another.

After copying the HTTP and Auth section details, pasting the Cloud Access Policy token into the Password field, and changing any of the other options that you want, you can save and test the data source.

## Next steps

- [Configure the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/): Return to connection, authentication, and streaming settings.
- [Configure trace to logs correlation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/): Set up span-to-log navigation.
- [Additional settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/additional-settings/): Configure Service graph, node graph, search, and other settings.
