---
labels:
  products:
    - enterprise
    - oss
title: Use Correlations Editor in Explore
weight: 70
---

# Use Correlations Editor in Explore

## Before you begin

This example shows how to create a correlation using Correlations Editor in Explore.

Correlations allow you to use results of one query to run a new query in any data source. In this example you will run a query that renders tabular data. The data will be used to run a different query that yields a graph result.

Please make sure you have setup up [a test data source]({{< relref "/docs/grafana/latest/datasources/testdata/#testdata-data-source" >}}).

## Create a new correlation

1. Go to Explore.
1. Select `test data source`.
1. Click on "+ Add" dropdown and select "Add correlation" button.
1. Explore is now in Correlations Editor mode indicated by a blue border.
1. Select scenario: `CSV File`.
1. Select file: `population_by_state.csv`.
1. Note that each cell is a link that you can click on to start creating a new correlation.

   {{< figure src="/static/img/docs/correlations/screenshot-correlations-editor-source-10.2.png" max-width="600px" caption="Selecting the source of a correlation" >}}

1. Create new correlation that attaches a data link in the `State` column: click on any cell in the `State` column, e.g. "California".
1. Explore opens in split view. Select the same data source you selected in the left pane.
1. The helper above the query editor contains all available variables you can use the target query. Variables contain all data fields (table columns) from the selected row.
1. Select Scenario: `CSV Metric Values`.
1. In the Query Editor's `String Input` field provide variables with population values for each year: `${1980},${2000},${2020}`. This will generate a graph using variable values.
1. In the Query Editor's `Alias` field, write `${State}`

   {{< figure src="/static/img/docs/correlations/screenshot-correlations-editor-target-10.2.png" max-width="600px" caption="Setting up the target of a correlation" >}}

1. Run a query to see that it produces a graph using sample values from the variables.
1. Save the correlation using "Save" button in the top.

## Test a newly created correlations

1. Once the correlation is saved Explore will exit Correlations Editor automatically and re-rerun the query in the left pane.
1. Click on a state name. Note how values from the row are inserted into the query on the right and the graph changes using the values for each row. The query is rerun with updates values every time you click on a state name.

   {{< figure src="/static/img/docs/correlations/screenshot-correlations-example-link-10.2.png" max-width="600px" caption="Result of clicking on a data link" >}}

You can apply the same steps to any data source. Correlations allow you to create links in visualizations to run dynamic queries based on selected data. In this example we used data returned by a query to build a new query generating different visualization using the same data source. However, you can create correlations between any data sources to create custom exploration flows.

## Correlations in the logs panel

Correlations links in the logs panel show slightly differently than the table panel. When you enter the Correlation Editor mode when looking at logs, you will need to expand a log line to see the button that serves as the correlation link.

{{< figure src="/static/img/docs/correlations/screenshot-correlations-editor-logs-10.2.png" max-width="600px" caption="Logs panel in the Correlations Editor" >}}
