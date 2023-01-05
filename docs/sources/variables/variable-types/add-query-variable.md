---
aliases:
  - ../add-query-variable.md/
title: Add a query variable
weight: 100
---

# Add a query variable

Query variables allow you to write a data source query that can return a list of metric names, tag values, or keys. For example, a query variable might return a list of server names, sensor IDs, or data centers. The variable values change as they dynamically fetch options with a data source query.

Query variables are generally only supported for strings. If your query return numbers or any other data type, you may need to convert them to strings in order to use them as variables. For the Azure data source, for example, you can use the [tostring](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/tostringfunction) function for this purpose.

Query expressions can contain references to other variables and in effect create linked variables. Grafana detects this and automatically refreshes a variable when one of its linked variables change.

## Query expressions

Query expressions are different for each data source. For more information, refer to the documentation for your [data source]({{< relref "../../datasources/_index.md" >}}).

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Query**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value. This is the default.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   - **Variable -** No variable dropdown is displayed on the dashboard.

## Enter Query Options

1. In the **Data source** list, select the target data source for the query. For more information about data sources, refer to [Add a data source]({{< relref "../../datasources/add-a-data-source.md" >}}).
1. In the **Refresh** list, select when the variable should update options.
   - **On Dashboard Load -** Queries the data source every time the dashboard loads. This slows down dashboard loading, because the variable query needs to be completed before dashboard can be initialized.
   - **On Time Range Change -** Queries the data source when the dashboard time range changes. Only use this option if your variable options query contains a time range filter or is dependent on the dashboard time range.
1. In the **Query** field, enter a query.
   - The query field varies according to your data source. Some data sources have custom query editors.
   - If you need more room in a single input field query editor, then hover your cursor over the lines in the lower right corner of the field and drag downward to expand.
1. (optional) In the **Regex** field, type a regex expression to filter or capture specific parts of the names returned by your data source query. To see examples, refer to [Filter variables with regex]({{< relref "../filter-variables-with-regex.md" >}}).
1. In the **Sort** list, select the sort order for values to be displayed in the dropdown list. The default option, **Disabled**, means that the order of options returned by your data source query will be used.
1. (optional) Enter [Selection Options]({{< relref "../variable-selection-options.md" >}}).
1. In **Preview of values**, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Add** to add the variable to the dashboard.
