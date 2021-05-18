+++
title = "View exemplar data"
description = "Exemplars"
keywords = ["grafana", "concepts", "exemplars", "prometheus"]
weight = 400
+++

# View exemplar data

When support for exemplar support is enabled for a Prometheus data source, you can view exemplar data either in the Explore view or from the Loki log details. 

## In Explore

Explore visualizes exemplar traces as highlighted stars alongside metrics data. For more information on how Explore visualizes trace data, refer to [tracing in Explore]({{< relref "../../explore/trace-integration.md" >}}).

{{< docs-imagebox img="/img/docs/basics/exemplar-explore-view.png" class="docs-image--no-shadow" max-width= "750px" caption="Exemplars in Explore view" >}}

To examine the details of an exemplar trace:

1. Place your cursor over an exemplar (highlighted star) to view the details of the exemplar trace. In the following example, the tracing data source in use is Tempo. 

{{< docs-imagebox img="/img/docs/basics/exemplar-trace-details.png" class="docs-image--no-shadow" max-width= "750px" caption="Exemplar details" >}}

1. Click the **Trace with Tempo** option next to the `traceID` property. The details, including the spans within the trace are listed in a separate pane.

{{< docs-imagebox img="/img/docs/basics/exemplar-span-details.png" class="docs-image--no-shadow" max-width= "750px" caption="Trace details" >}}

You can view various metadata about the trace, 

1. To drill-down to the view the details of a span, expand a span.   

{{< docs-imagebox img="/img/docs/basics/exemplar-span-details.png" class="docs-image--no-shadow" max-width= "750px" caption="Span details" >}}

## In logs

You can also view exemplar trace details from the Loki logs. Use regex within the Derived fields links for Loki to extract the `traceID` information. Now when you expand Loki logs, you will id see the `traceID` property under the **Detected fields** section. To learn more about how to extract a part of a log message into an internal or external link, refer to 

To view the trace details:

1. Click the **Trace with Tempo** button next to the `traceID` property. The details, including the spans within the trace are listed in a separate pane.
1. To the view the details of an individual span, expand a span.
 


