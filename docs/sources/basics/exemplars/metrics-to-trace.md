+++
title = "Metrics to trace"
description = "Exemplars"
keywords = ["grafana", "concepts", "exemplars", "prometheus"]
weight = 400
+++

# Viewing exemplar details

When support for exemplar support is enabled for a Prometheus data source, you can view exemplar data either in the Explore view or from log details. 

## Viewing exemplar data in Explore

Explore visualizes exemplar traces as highlighted stars. For more information, refer to [tracing in Explore]({{< relref "../../explore/trace-integration.md" >}}).

To examine the details of an exemplar trace:

1. Place your cursor over an exemplar (highlighted star) to view the details of the exemplar trace. In the following example, the tracing data source in use is Tempo. Other supported data sources are Jeager, X-Ray and Zipkin.

{{< docs-imagebox img="/img/docs/basics/exemplar-details.png" class="docs-image--no-shadow" max-width= "750px" caption="Exemplar details" >}}

1. Click the **Trace with Tempo** option next to the `traceID` property. The details, including the spans within the trace are listed in a separate pane.

1. To drill-down to the view the details of a span, expand the 

## Viewing exemplar traces in logs

You can also view exemplar traces and their details from Loki logs. 


