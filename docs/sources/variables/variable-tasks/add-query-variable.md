+++
title = "Add a query variable"
type = "docs"
[menu.docs]
weight = 500
+++

# Add a query variable

Query variables allow you to write a data source query that usually returns a list of metric names, tag values, or keys. For example, a query variable might return a list of server names, sensor IDs, or data centers.

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
2. Click **Variables** and then click **New**.

## Adding a variable

{{< docs-imagebox img="/img/docs/v50/variables_var_list.png" max-width="800px" >}}

You add variables via Dashboard cogs menu > Templating. This opens up a list of variables and a `New` button to create a new variable.

### Basic variable options

Option | Description
------- | --------
*Name* | The name of the variable, this is the name you use when you refer to your variable in your metric queries. Must be unique and contain no white-spaces.
*Label* | The name of the dropdown for this variable.
*Hide* | Options to hide the dropdown select box.
*Type* | Defines the variable type.
