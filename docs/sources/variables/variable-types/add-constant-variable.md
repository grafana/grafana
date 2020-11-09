+++
title = "Add a constant variable"
type = "docs"
aliases = ["/docs/grafana/latest/variables/add-constant-variable.md"]
[menu.docs]
identifier = "add-constant-variable"
parent = "variable-types"
weight = 400
+++

# Add a constant variable

_Constant_ variables allow you to define a hidden constant. This is useful for metric path prefixes for dashboards you want to share. When you export a dashboard, constant variables are converted to import options.

Constant variables are _not_ flexible. Each constant variable only holds one value, and it cannot be updated unless you update the variable settings. 

Constant variables are useful when you have complex values that you need to include in queries but don't want to retype in every single query. For example, if you had a server path called `i-0b6a61efe2ab843gg`, then you could replace it with a variable called `$path_gg`.

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Constant**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **Variable -** No variable dropdown is displayed on the dashboard. This is the default. 
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   
## Enter Constant options

1. In the **Value** field, enter the variable value. You can enter letters, numbers, and symbols. You can even use wildcards if you use [raw format]({{< relref "../advanced-variable-format-options.md#raw" >}}).
1. In **Preview of values**, Grafana displays the current variable value. Review it to ensure it matches what you expect.
1. Click **Add** to add the variable to the dashboard.
