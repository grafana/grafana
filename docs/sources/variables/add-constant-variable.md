+++
title = "Add a constant variable"
type = "docs"
[menu.docs]
weight = 500
+++

# Add a constant variable

_Custom_ variables allow you to define a hidden constant. This is useful for metric path prefixes for dashboards you want to share. When you export a dashboard, constant variables are converted to an import option.

Custom variables are not flexible, but they are useful when you have complex values that you need to include in queries but don't want to retype every time. For example, if you had a server called `i-0b6a61efe2ab843gg`, you could replace it with a variable called `$server_gg`.

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
   

## Enter Text options

1. In the **Default value** field, select the default value for the variable. If you do not enter anything in this field, then Grafana displays an empty text box for users to type in. 
2. In **Preview of values**, Grafana displays a list of the current variable values. Review them to ensure they match what you expect.
3. Click **Add** to add the variable to the dashboard.
