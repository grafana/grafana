+++
title = "Metrics to trace"
description = "Exemplars"
keywords = ["grafana", "concepts", "exemplars", "prometheus"]
weight = 400
+++

# Viewing exemplar details

When exemplar support is enabled for a Prometheus data source, Explore allows you to visualize traces from tracing data sources. For more information, refer to [tracing in Explore]({{< relref "../../explore/trace-integration.md" >}}).

To drill down to and examine trace details:

1. Place your cursor over an exemplar (each exemplar displays as a highlighted star).
1. Click the option  next to the `traceID` property.


and in dashboards. Each exemplar displays as a highlighted star. You can hover your cursor over an exemplar to view the unique traceID, which is a combination of a key value pair. To investigate further, click the blue button next to the `traceID` property. 

{{< docs-imagebox img="/img/docs/v74/exemplars.png" class="docs-image--no-shadow" max-width= "750px" caption="Screenshot showing the detail window of an Exemplar" >}}
