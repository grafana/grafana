+++
title = "Add a data source variable"
type = "docs"
aliases = ["/docs/grafana/latest/variables/add-data-source-variable.md"]
[menu.docs]
identifier = "add-datasource-variable"
parent = "variable-types"
weight = 500
+++

# Add a data source variable

_Data source_ variables allow you to quickly change the data source for an entire dashboard. They are useful if you have multiple instances of a data source, perhaps in different environments.

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Datasource**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value. This is the default.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   - **Variable -** No variable dropdown is displayed on the dashboard.

## Enter Data source options

1. In the **Type** list, select the target data source for the variable. For more information about data sources, refer to [Add a data source]({{< relref "../../features/datasources/add-a-data-source.md" >}}).
1. (optional) In **Instance name filter**, enter a regex filter for which data source instances to choose from in the variable value drop-down list. Leave this field empty to display all instances.
1. (optional) Enter [Selection Options]({{< relref "../variable-selection-options.md" >}}).
1. In **Preview of values**, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Add** to add the variable to the dashboard.
