+++
title = "Using Jaeger in Grafana"
description = "Guide for using Jaeger in Grafana"
keywords = ["grafana", "jaeger", "guide", "tracing"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/jeager"]
[menu.docs]
name = "Jaeger"
parent = "datasources"
weight = 2
+++

# Using Jager in Grafana

Grafana ships with built-in support for Jaeger, open source, end-to-end distributed tracing.
Just add it as a data source and you are ready to query your traces in [Explore]({{< relref "../explore" >}}).

## Adding the data source

1. Open Grafana and make sure you are logged in.
2. In the side menu under the `Configuration` link you should find a link named `Data Sources`.
3. Click the `Add data source` button at the top.
4. Select `Loki` from the list of data sources.

> Note: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

| Name            | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_          | The data source name. This is how you refer to the data source in panels, queries, and Explore.                                                 |
| _Default_       | Default data source means that it will be pre-selected for new panels.                                                                         |
| _URL_           | The URL of the Jaeger instance, e.g., `http://localhost:16686`                                                                                   |

## Querying traces

Querying and displaying traces from Jaeger is available via [Explore]({{< relref "../explore" >}}).


Jaeger query editor allows you to query by trace ID directly or selecting a trace from trace selector. To query by trace ID insert the ID into the text input.

TODO: screenshot query editor with trace ID filled in

Use the trace selector to pick particular trace from all traces logged in the time range you have selected in Explore. The trace selector has three levels of nesting:
1. The service you are interested in.
1. Particular operation is part of the selected service
1. Specific trace in which the selected operation occurred, represented by the root operation name and trace duration.

TODO: screenshot trace selector opened up

## Links

You can link to Jaeger trace from logs in Loki by configuring a derived field with internal link. See [Loki documentation]([Explore]({{< relref "./loki#derived-fields" >}})) for details.


