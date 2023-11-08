---
headless: true
labels:
  products:
    - enterprise
    - oss
---

[//]: # 'This file documents the Traces to profile configure and usage for the Tempo data source.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/grafana/docs/sources/datasources/tempo/configure-tempo-data-source.md'
[//]: # '/website/docs/grafana-cloud/data-configuration/traces/traces-query-editor.md'
[//]: #
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

<!-- # Trace to profiles  -->

{{< docs/experimental product="Trace to profiles" featureFlag="traceToProfiles" >}}

Using Trace to profiles, you can use Grafana’s ability to correlate different signals by adding the functionality to link between traces and profiles.

**Trace to profiles** lets you link your Grafana Pyroscope data source to tracing data.
When configured, this connection lets you run queries from a trace span into the profile data.

To use tract to profiles, you must have a configured Grafana Pyroscope data source.

1. Select the Pyroscope data source from the **Data source** drop-down.
1. Optional: Choose any tags that will be used in the query. If left blank. the default values of `service.name` and `service.namespace` are used.
1. Select one or more profile types to use in the query. Select the drop-down and choose options from the menu.
1. Optional: Toggle **Use custom query** to enter a custom query. You can interpolate the configured tags using the `$__tags` keyword.
1. Select **Save and Test**.

To use trace to profile, navigate to **Explore** and query a trace. Each span now links to your queries. Clicking a link runs the query in a split panel. If tags are configured, Grafana dynamically inserts the span attribute values into the query. The query runs over the time range currently selected in **Explore**.
