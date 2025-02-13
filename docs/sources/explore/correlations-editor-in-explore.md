---
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Correlations Editor in Explore
weight: 20
---

# Correlations Editor in Explore

{{% admonition type="note" %}}
The Explore editor is available in 10.1 and later versions. In the editor, transformations is available in Grafana 10.3 and later versions.
{{% /admonition %}}

Correlations allow users to build a link between any two data sources. For more information about correlations in general, please see the [correlations](/docs/grafana/<GRAFANA_VERSION>/administration/correlations/) topic in the administration page.

## Create a correlation

1. In Grafana, navigate to the Explore page.
1. Select a data source that you would like to be [the source data source](/docs/grafana/<GRAFANA_VERSION>/administration/correlations/correlation-configuration/#source-data-source-and-result-field) for a new correlation.
1. Run a query producing data in [a supported visualization](/docs/grafana/<GRAFANA_VERSION>/administration/correlations/#correlations).
1. Click **+ Add** in the top toolbar and select **Add correlation** (you can also select **Correlations Editor** from the [Command Palette](/docs/grafana/<GRAFANA_VERSION>/search/#command-palette)).
1. Explore is now in Correlations Editor mode indicated by a blue border and top bar. You can exit Correlations Editor by clicking **Exit** in the top bar.
1. You can now create the following new correlations for the visualization with links that are attached to the data that you can use to build a new query:
   - Logs: links are displayed next to field values inside log details for each log row
   - Table: every table cell is a link
1. Click on a link to add a new correlation.
   Links are associated with a field that is used as a [result field of a correlation](/docs/grafana/<GRAFANA_VERSION>/administration/correlations/correlation-configuration/).
1. In the split view that opens, use the right pane to set up [the target query source of the correlation](/docs/grafana/<GRAFANA_VERSION>/administration/correlations/correlation-configuration/#target-query).
1. Build a target query using [variables syntax](/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/) with variables from the list provided at the top of the pane. The list contains sample values from the selected data row.
1. Provide a label and description (optional).
   A label will be used as the name of the link inside the visualization and can contain variables.
1. Provide transformations (optional; see below for details).
1. Click **Save** in the top toolbar to save the correlation and exit Correlations Editor mode.
   The link used to create the correlation is replaced with a data link in each row. When the link is clicked, the query you defined will run in another pane, with the variables replaced dynamically with the values from the selected row.

## Transformations

Transformations allow you to extract values that exist in a field with other data. For example, using a transformation, you can extract one portion of a log line to use in a correlation. For more details on transformations in correlations, see [Correlations](/docs/grafana/<GRAFANA_VERSION>/explore/correlations-editor-in-explore/#transformations).

After clicking one of the generated links in the editor mode, you can add transformations by clicking **Add transformation** in the Transformations dropdown menu.

You can use a transformation in your correlation with the following steps:

1. Select a field to apply the transformation to.
   Select the portion of the field that you want to use for the transformation. For example, a log line.
   Once selected, the value of this field will be used to assist you in building the transformation.
1. Select the type of the transformation.
   See [correlations](/docs/grafana/<GRAFANA_VERSION>/explore/correlations-editor-in-explore/#transformations) for the options and relevant settings.
1. Based on your selection, you might see one or more variables populate, or you might need to provide more specifications in options that are displayed.
1. Select **Add transformation to correlation** to add the specified variables to the list of available variables.

### Notes for regular expressions

For regular expressions in this dialog box, the `mapValue` referred to in other documentation is called `Variable Name` here. Grafana highlights any text that matches the expression in the field value. Use regular expression capture groups to select what portion of the match should be extracted. When a valid regular expression is provided, the variable and the value of that variable appear below the `Variable Name` field.

## Correlations examples

The following examples show how to create correlations using the Correlations Editor in Explore. If you'd like to follow these examples, make sure to set up a [test data source](/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/#testdata-data-source).

### Create a text to graph correlation

This example shows how to create a correlation using Correlations Editor in Explore.

Correlations allow you to use results of one query to run a new query in any data source. In this example, you will run a query that renders tabular data. The data will be used to run a different query that yields a graph result.

To follow this example, make sure you have set up [a test data source](/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/#testdata-data-source).

1. In Grafana, navigate to **Explore**.
1. Select the **test data source** from the dropdown menu at the top left of the page.
1. Click **+ Add** in the dropdown menu to the right and select **Add correlation**.
1. Explore is now in Correlations Editor mode, indicated by a blue border.
1. Select the following scenario from the scenario dropdown menu: **CSV File**.
1. Select the file, **population_by_state.csv**.
   Each cell is a link that you can click on to begin creating a new correlation.

   {{< figure src="/static/img/docs/correlations/screenshot-correlations-editor-source-10.2.png" max-width="600px" caption="Selecting the source of a correlation" >}}

1. Click on any cell in the `State` column to create a new correlation that attaches a data link to that entry. For example, select "California".
1. In the split view, select the same data source you selected in the left pane.
   The helper above the query editor contains all available variables you can use the target query. Variables contain all data fields (table columns) from the selected row.
1. In the **Scenario** menu, select **CSV Metric Values**.
   The `String Input` field in the Query editor provides variables with population values for each year: `${1980},${2000},${2020}`. This will generate a graph using variable values.
1. In the Query Editor **Alias** field, enter "${State}".

   {{< figure src="/static/img/docs/correlations/screenshot-correlations-editor-target-10.2.png" max-width="600px" caption="Setting up the target of a correlation" >}}

   Run a query to see that it produces a graph using sample values from the variables.

1. Click **Save** to save the correlation and exit the Correlations Editor.

   After the correlation is saved, Explore will rerun the query in the left pane. By clicking a state name, the query on the right is rerun with values from the row being inserted into the CSV, thus changing the graph. The query is rerun with updated values every time you click on a state name.

   {{< figure src="/static/img/docs/correlations/screenshot-correlations-example-link-10.2.png" max-width="600px" caption="Result of clicking on a data link" >}}

You can apply the same steps to any data source. Correlations allow you to create links in visualizations to run dynamic queries based on selected data. In this example we used data returned by a query to build a new query generating different visualization using the same data source. However, you can create correlations between any data sources to create custom exploration flows.

### Create a logs to table correlation

In this example, you will create a correlation to demonstrate how to use transformations to extract values from the log line and another field.

To follow this example, make sure you have set up [a test data source](/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/#testdata-data-source).

1. In Grafana, navigate to **Explore**.
1. Select the **test data source** from the dropdown menu at the top left of the page.
1. Click **+ Add** in the dropdown menu to the right and select **Add correlation**.
1. Explore is now in Correlations Editor mode, indicated by a blue border.
1. In the **Scenario** menu, select **Logs**.
1. Expand a log line to see the correlation links. Select `Correlate with hostname`.
1. Explore opens in split view. Select the same data source you selected in the left pane.
   The helper above the query editor contains all available variables you can use the target query.
1. Expand the transformations section, and click **Add transformation**.
1. In the **Field** dropdown menu, select **message**.
   The log line shows up as example data.
1. Under **Type**, select **Logfmt**.
   This populates the list of variables.
1. Click **Add transformation to correlation**.
1. Click **Add transformation** again and under **Field**, select **hostname**.
1. Under **Type**, select **Regular expression**.
1. Under **Expression**, enter the following:
   `-([0-9]\*)`
   This selects any numbers to the right of the dash.
1. Under **Variable Name**, enter the following:
   hostNumber
   This populates the list of variables.
1. Click **Add transformation to correlation** to add it to the other variables.
1. In the data source editor, open the **Scenario** dropdown menu and select **CSV Content**.
1. In the text box below, provide the following and save the correlation:

   ```csv
   time,msg,hostNumber,status
   ${time},${msg},${hostNumber},${status}
   ```

   This closes the split view and reruns the left query. Expand any log line to see the correlation button. Clicking the correlation button opens the split view with the `time` (a field), `msg` (extracted with `logfmt` from the log line), host number (extracted with `regex` from the `hostname`) and the `status` (extracted with `logfmt` from the log line).
