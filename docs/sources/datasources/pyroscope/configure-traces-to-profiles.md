---
title: Configure traces to profiles
menuTitle: Configure traces to profiles
description: Learn how to configure the traces to profiles integration in Grafana and Grafana Cloud.
weight: 300
keywords:
  - continuous profiling
  - tracing
  - span profiles
  - trace to profiles
---

# Configure Trace to profiles

Trace to profiles lets you navigate from a trace span directly to the profiling data for that span. You configure the integration in the Tempo data source, which connects your tracing data in Tempo with your profiling data in Pyroscope.

{{< admonition type="note" >}}
Your application must be instrumented for profiles and traces. For more information, refer to [Link traces to profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/).
{{< /admonition >}}

[//]: # 'Shared content for Trace to profiles in the Tempo data source'

{{< docs/shared source="grafana" lookup="datasources/tempo-traces-to-profiles.md" version="<GRAFANA VERSION>" >}}

## Verify the integration

After you configure the Tempo data source and instrument your application, verify that the integration works.

1. Open a trace in **Explore** using your Tempo data source.
1. Expand a span to view its details.
1. Confirm that the **Profiles for this span** button appears in the span details.
1. Confirm that an embedded flame graph appears in the span details section.

If the span attribute `pyroscope.profile.id` isn't present on the span, the OTel bridge package isn't configured correctly. Refer to [Link tracing and profiling with span profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/) for per-language setup instructions.

## Troubleshoot trace to profiles

Use the following checklist to diagnose common issues with the Trace to profiles integration.

### No "Profiles for this span" button appears

1. Verify that you installed and configured the OTel bridge package for your language. This is a separate package from the Pyroscope SDK and OpenTelemetry SDK. Refer to [Link tracing and profiling with span profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/) for per-language instructions.
1. Check that the `pyroscope.profile.id` attribute exists on the span in Tempo. If it's missing, the bridge package isn't tagging spans correctly.
1. Check that the `span_name` label exists on the profiling data in Pyroscope. If it's missing, the bridge package isn't labeling profiling samples correctly.
1. Verify that the tags you configured in the Tempo data source are present in the span's attributes or resources. If the tags don't match, the span link doesn't appear.

### Button appears but no profile data is shown

1. The span might be shorter than the sampling interval of the profiler. Span profiling is most effective on spans longer than 20ms.
1. CPU profiling only captures time spent actively executing on the CPU. If the span is mostly waiting on I/O, network calls, or database queries, the CPU profile for that span may be sparse or empty.
1. Verify that the profile type selected in the Tempo data source configuration matches the profile type your application sends.

### Tags don't match

Tags you configure in the Tempo data source must be present in the span's attributes or resources. If a tag has dots in its name, for example, `service.name`, and the Pyroscope data source doesn't allow dots in labels, remap it to a name without dots, for example, `service_name`.
