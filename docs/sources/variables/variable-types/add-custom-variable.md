+++
title = "Add a custom variable"
type = "docs"
aliases = ["/docs/grafana/latest/variables/add-custom-variable.md"]
[menu.docs]
weight = 500
+++

# Add a custom variable

Use a _custom_ variable for values that do not change. This might be numbers, strings, or even other variables.

For example, if you have server names or region names that never change, then you might want to create them as custom variables rather than query variables. Because they do not change, you might use them in [chained variables]({{< relref "chained-variables.md" >}}) rather than other query variables. That would reduce the number of queries Grafana must send when chained variables are updated. 

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Custom**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value. This is the default.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   - **Variable -** No variable dropdown is displayed on the dashboard.

## Enter Custom Options

1. In the **Values separated by comma** list, enter the values for this variable in a comma-separated list. You can include numbers, strings, or other variables.
1. (optional) Enter [Selection Options]({{< relref "../variable-selection-options.md" >}}).
1. In **Preview of values**, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Add** to add the variable to the dashboard.
