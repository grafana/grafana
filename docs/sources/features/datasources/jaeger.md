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

# Jaeger data source

Grafana ships with built-in support for Jaeger, which provides open source, end-to-end distributed tracing.
Just add it as a data source and you are ready to query your traces in [Explore]({{< relref "../../explore/index.md" >}}).

## Adding the data source
To access Jaeger settings, click the **Configuration** (gear) icon, then click **Data Sources**, and then click **Jaeger**.

| Name            | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_          | The data source name. This is how you refer to the data source in panels, queries, and Explore.                                                 |
| _Default_       | Default data source means that it will be pre-selected for new panels.                                                                         |
| _URL_           | The URL of the Jaeger instance, e.g., `http://localhost:16686`                                                                                   |
| _Access_        | Server (default) = URL needs to be accessible from the Grafana backend/server, Browser = URL needs to be accessible from the browser. |
| _Basic Auth_    | Enable basic authentication to the Jaeger data source.                                                                            |
| _User_          | User name for basic authentication.                                                                                                   |
| _Password_      | Password for basic authentication.                                                                                                    |

## Query traces

You can query and display traces from Jaeger via [Explore]({{< relref "../../explore/index.md" >}}).

{{< docs-imagebox img="/img/docs/v70/jaeger-query-editor.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor" >}}

The Jaeger query editor allows you to query by trace ID directly or selecting a trace from trace selector. To query by trace ID, insert the ID into the text input.

{{< docs-imagebox img="/img/docs/v70/jaeger-query-editor-open.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor with trace selector expanded" >}}

Use the trace selector to pick particular trace from all traces logged in the time range you have selected in Explore. The trace selector has three levels of nesting:
1. The service you are interested in.
1. Particular operation is part of the selected service
1. Specific trace in which the selected operation occurred, represented by the root operation name and trace duration.

## Linking Trace ID from logs

You can link to Jaeger trace from logs in Loki by configuring a derived field with internal link. See the [Derived fields]({{< relref "loki.md#derived-fields" >}}) section in the [Loki data source]({{< relref "loki.md" >}}) documentation for details.
