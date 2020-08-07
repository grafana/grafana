+++
title = "Troubleshoot queries"
description = "Guide to troubleshooting Grafana queries"
keywords = ["grafana", "troubleshooting", "documentation", "guide", "queries"]
type = "docs"
[menu.docs]
weight = 400
+++




#### Inspecting Datapoints

Click `Inspect Query` on the right side of `Data Source` row to inspect response from metrictank.

### How can I modify the metric name in my tables or charts ((Graphite function))

### Why do I get different results when I rearrange my functions?

Function order is very important. Just like in math, the order that you place your functions can effect the result.

## Visualization and query issues

{{< imgbox max-width="40%" img="/img/docs/v45/query_inspector.png" caption="Query Inspector" >}}

The most common problems are related to the query and response from your data source. Even if it looks
like a bug or visualization issue in Grafana, it is almost always a problem with the data source query or
the data source response.

To check this you should use query inspector. The query inspector shows query requests and responses. Refer to the data source page for more information.

For more on the query inspector read the Grafana Community article [Using Grafana’s Query Inspector to troubleshoot issues](https://community.grafana.com/t/using-grafanas-query-inspector-to-troubleshoot-issues/2630). For older versions of Grafana, refer to the [How troubleshoot metric query issue](https://community.grafana.com/t/how-to-troubleshoot-metric-query-issues/50/2) article.
