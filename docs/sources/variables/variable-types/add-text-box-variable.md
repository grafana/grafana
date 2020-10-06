+++
title = "Add a text box variable"
type = "docs"
aliases = ["/docs/grafana/latest/variables/add-text-box-variable.md"]
[menu.docs]
identifier = "add-text-box-variable"
parent = "variable-types"
weight = 300
+++

# Add a text box variable

_Text box_ variables display a free text input field with an optional default value. This is the most flexible variable, because you can enter any value. Use this type of variable if you have metrics with high cardinality or if you want to update multiple panels in a dashboard at the same time.

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Text box**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value. This is the default.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   - **Variable -** No variable dropdown is displayed on the dashboard.

## Enter Text options

1. (optional) In the **Default value** field, select the default value for the variable. If you do not enter anything in this field, then Grafana displays an empty text box for users to type text into. 
1. In **Preview of values**, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
1. Click **Add** to add the variable to the dashboard.
