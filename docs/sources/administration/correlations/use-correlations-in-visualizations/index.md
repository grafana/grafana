---
title: Use correlations in visualizations
weight: 70
---

# Use correlations in visualizations

## Correlations in Logs Panel

1. Setup a correlation
1. Open Explore
1. Select a data source that you chose as the source data source of the correlation
1. Run a query that results in data containing fields required to build variables in the target query.
1. Expand log row details
1. If the selected row contains all the information required to build the target query a link appears in the “Links” section at the bottom.
1. Additional information about used variables and their values is shown next to each link.

   {{< figure src="/static/img/docs/correlations/correlations-in-logs-panel-10-0.png" max-width="600px" caption="Correlation links in Logs panel" >}}

## Correlations in Table

1. Setup a correlation
1. Open Explore
1. Select a data source that you chose as the source data source of the correlation
1. Run a query that results in data containing fields required to build variables in the target query.
1. Links are added to cell rows in the column representing the field with the assigned link ([the results field]({{< relref "/docs/grafana/latest/administration/correlations/correlation-configuration#source-data-source-and-result-field" >}}).
1. Cells containing multiple links accessible with a context menu.

   {{< figure src="/static/img/docs/correlations/correlations-in-table-10-0.png" max-width="600px" caption="Correlations links in table" >}}
