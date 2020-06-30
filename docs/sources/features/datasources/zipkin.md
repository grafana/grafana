+++
title = "Using Zipkin in Grafana"
description = "Guide for using Zipkin in Grafana"
keywords = ["grafana", "zipkin", "guide", "tracing"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/zipkin"]
[menu.docs]
name = "Zipkin"
parent = "datasources"
weight = 2
+++

# Zipkin data source

Grafana ships with built-in support for Zipkin, an open source, distributed tracing system.
Just add it as a data source and you are ready to query your traces in [Explore]({{< relref "../explore" >}}).

## Adding the data source
To access Zipkin settings, click the **Configuration** (gear) icon, then click **Data Sources**, and then click **Zipkin**.

| Name            | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_          | The data source name. This is how you refer to the data source in panels, queries, and Explore.                                                 |
| _Default_       | Default data source means that it will be pre-selected for new panels.                                                                         |
| _URL_           | The URL of the Zipkin instance, e.g., `http://localhost:9411`                                                                                   |
| _Access_        | Server (default) = URL needs to be accessible from the Grafana backend/server, Browser = URL needs to be accessible from the browser. |
| _Basic Auth_    | Enable basic authentication to the Zipkin data source.                                                                            |
| _User_          | User name for basic authentication.                                                                                                   |
| _Password_      | Password for basic authentication.                                                                                                    |

## Query traces

Querying and displaying traces from Zipkin is available via [Explore]({{< relref "../explore" >}}).

{{< docs-imagebox img="/img/docs/v70/zipkin-query-editor.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin query editor" >}}

The Zipkin query editor allows you to query by trace ID directly or selecting a trace from trace selector. To query by trace ID, insert the ID into the text input.

{{< docs-imagebox img="/img/docs/v70/zipkin-query-editor-open.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin query editor with trace selector expanded" >}} 

Use the trace selector to pick particular trace from all traces logged in the time range you have selected in Explore. The trace selector has three levels of nesting:
1. The service you are interested in.
1. Particular operation is part of the selected service
1. Specific trace in which the selected operation occurred, represented by the root operation name and trace duration.

## Data mapping in the trace UI

Zipkin annotations are shown in the trace view as logs with annotation value shown under annotation key.

## Linking Trace ID from logs

You can link to Zipkin trace from logs in Loki by configuring a derived field with internal link. See [Loki documentation]([Explore]({{< relref "./loki#derived-fields" >}})) for details.
