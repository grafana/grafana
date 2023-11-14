---
labels:
  products:
    - enterprise
    - oss
title: Correlations Editor in Explore
weight: 400
---

# Correlations Editor in Explore

{{% admonition type="note" %}}
The Explore editor is available in 10.1 and later versions. In the editor, transformations is available in Grafana 10.3 and later versions.
{{% /admonition %}}

Correlations allow users to build a link between any two datasources. For more information about correlations in general, please see the [documentation]({{< relref "../administration/correlations" >}}) about building correlations in the administration page.

## Create a correlation

1. Go to Explore page.
1. Select a data source that you would like to be [the source data source]({{< relref "../administration/correlations/correlation-configuration#source-data-source-and-result-field" >}}) for a new correlation.
1. Run a query producing data in [a supported visualization]({{< relref "../administration/correlations#correlations" >}}).
1. Click "+ Add" button in the top toolbar and select "Add correlation" (you can also select "Correlations Editor" from the [Command Palette]({{< relref "../search#command-palette" >}})).
1. Explore is now in Correlations Editor mode indicated by a blue border and top bar. You can exit Correlations Editor using the Exit button in the top bar.
1. The visualization is enriched with links allowing to create new correlations. Links are attached to the data that you can use to build a new query:
   - Logs: links are displayed next to field values inside log details for each log row
   - Table: every table cell is a link
1. Click on a link to begin adding new correlation. Links are associated with a field that will be used as [a results field of a correlation]({{< relref "../administration/correlations/correlation-configuration" >}}). This means the correlation link will be created on the link you select once the correlation is saved.
1. Explore opens a split view. Use the right pane to setup [the target query source of the correlation]({{< relref "../administration/correlations/correlation-configuration#target-query" >}}).
1. Build target query using [variables syntax]({{< relref "../dashboards/variables/variable-syntax" >}}) with variables from the list provided at the top of the pane. The list contains sample values from the selected data row.
1. Provide optional label and description. Label is used as the name of the link inside the visualization. It can contain variables.
1. Provide optional transformations (see below for details)
1. Click "Save" button in the top bar to save the correlation and exit Correlations Editor mode.
1. The link used to create the correlation will be replaced with a data link in each row. The variables will be dynamically replaced with values from a selected row.

## Transformations

Transformations allow you to extract values that exist in a field with other data. A prime example is getting one portion of a log line out to use in a correlation. For more details on transformations in correlations, see the [correlations documentation]({{< relref "../administration/correlations/correlation-configuration/#correlation-transformations" >}}).

After clicking one of the generated links in the editor mode, you can add transformations by clicking the "Add transformation" button in the "Transformations" dropdown. This will pop up a modal, and you can use a transformation in your correlation with the following steps:

1. First, select a field that the transformation will be applied. This should be a field where we only want to use sections of the field, such as a log line. Once selected, the value of that field will show up to assist building the transformation.
1. Select the type of the transformation. See the [correlations documentation]({{< relref "../administration/correlations/correlation-configuration/#correlation-transformations" >}}) for the options and relevant settings.
1. Based on what's selected, you may immediately see one or more variables populate, or you may need to provide more specifications in options that display.
1. Select `Add transformation to correlation` to add the specified variables to the list of variables in the list of variables available.

### Notes for regular expressions

For regular expressions in this modal, the `mapValue` referred to in other documentation is called `Variable Name` here. The field value will highlight with the matching text based on the expression. Use regular expression capture groups to select what portion of the match should be extracted. When a valid regular expression is provided, you will see the variable and the value of that variable appear below the `Variable Name` field.

## Example: Create a text to graph correlation

This example shows how to create a correlation using Correlations Editor in Explore.

Correlations allow you to use results of one query to run a new query in any data source. In this example you will run a query that renders tabular data. The data will be used to run a different query that yields a graph result.

Please make sure you have set up [a test data source]({{< relref "../datasources/testdata#testdata-data-source" >}}).

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

Once the correlation is saved Explore will exit Correlations Editor automatically and re-rerun the query in the left pane. By clicking a state name, the query on the right is re-ran with values from the row being inserted into the CSV, thus changing the graph. The query is rerun with updates values every time you click on a state name.

{{< figure src="/static/img/docs/correlations/screenshot-correlations-example-link-10.2.png" max-width="600px" caption="Result of clicking on a data link" >}}

You can apply the same steps to any data source. Correlations allow you to create links in visualizations to run dynamic queries based on selected data. In this example we used data returned by a query to build a new query generating different visualization using the same data source. However, you can create correlations between any data sources to create custom exploration flows.

## Example: Create a logs to table correlation

For this example, we will create a correlation to demonstrate how to use transformations to extract values from the log line and another field.

Please make sure you have set up [a test data source]({{< relref "../datasources/testdata#testdata-data-source" >}}).

1. Go to Explore.
1. Select `test data source`.
1. Click on "+ Add" dropdown and select `Add correlation` button.
1. Explore is now in Correlations Editor mode indicated by a blue border.
1. Select scenario: `Logs`.
1. Expand a log line to see the correlation links. Select `Correlate with hostname`.
1. Explore opens in split view. Select the same data source you selected in the left pane.
1. The helper above the query editor contains all available variables you can use the target query.
1. Expand the transformations section, and click the `Add transformation` button.
1. Under the `Field` dropdown, select `message`. See the log line shows up as example data.
1. Under `Type`, select `Logfmt`. See the list of variables populate.
1. Click `Add transformation to correlation`.
1. Again click the `Add transformation` button and under `Field`, select `hostname`.
1. Select `Regular expression` under `Type`.
1. Under `Expression`, type `-([0-9]*)`. This selects any numbers to the right of the dash.
1. Under `Variable Name`, type `hostNumber`
1. See the variable populate in the variable list.
1. Click `Add transformation to correlation` to add it to the other variables.
1. In the datasource editor, select Scenario: `CSV Content`.
1. In the text box below, provide the following and save the correlation.

```
time,msg,hostNumber,status
${time},${msg},${hostNumber},${status}
```

This will close the split view and re-run the left query. Expand any log line to see the correlation button. Clicking it will pull up the split view with the `time` (a field), `msg` (extracted with `logfmt` from the log line), host number (extracted with `regex` from the `hostname`) and the `status` (extracted with `logfmt` from the log line).
