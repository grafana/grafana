+++
title = "Tempo"
description = "High volume, minimal dependency trace storage. OSS tracing solution from Grafana Labs."
keywords = ["grafana", "tempo", "guide", "tracing"]
type = "docs"
aliases = ["/docs/grafana/latest/features/datasources/tempo"]
[menu.docs]
name = "Tempo"
parent = "datasources"
weight = 800
+++

# Tempo data source

Grafana ships with built-in support for Tempo a high volume, minimal dependency trace storage, OSS tracing solution from Grafana Labs. Add it as a data source, and you are ready to query your traces in [Explore]({{< relref "../explore/index.md" >}}).

## Adding the data source
To access Tempo settings, click the **Configuration** (gear) icon, then click **Data Sources** > **Tempo**.

| Name            | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_          | The data source name using which you will refer to the data source in panels, queries, and Explore.                                                 |
| _Default_       | The default data source will be pre-selected for new panels.                                                                         |
| _URL_           | The URL of the Tempo instance, e.g., `http://localhost:16686`                                                                                   |
| _Basic Auth_    | Enable basic authentication to the Tempo data source.                                                                            |
| _User_          | User name for basic authentication.                                                                                                   |
| _Password_      | Password for basic authentication.                                                                                                    |

## Query traces

You can query and display traces from Tempo via [Explore]({{< relref "../explore/index.md" >}}).
To query a particular trace, insert its trace ID into the query text input.

{{< docs-imagebox img="/img/docs/v73/tempo-query-editor.png" class="docs-image--no-shadow" caption="Screenshot of the Tempo query editor" >}}

## Linking Trace ID from logs

You can link to Tempo trace from logs in Loki or Elastic by configuring an internal link. See the [Derived fields]({{< relref "loki.md#derived-fields" >}}) section in the [Loki data source]({{< relref "loki.md" >}}) or [Data links]({{< relref "elasticsearch.md#data-links" >}}) section in the [Elastic data source]({{< relref "elasticsearch.md" >}}) for configuration instructions.
