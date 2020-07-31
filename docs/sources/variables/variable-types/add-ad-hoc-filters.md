+++
title = "Add ad hoc filters"
type = "docs"
aliases = ["/docs/grafana/latest/variables/add-ad-hoc-filters.md"]
[menu.docs]
weight = 500
+++

# Add ad hoc filters

_Ad hoc filters_ allow you to add key/value filters that are automatically added to all metric queries that use the specified data source. Unlike other variables, you do not use ad hoc filters in queries. Instead, you use ad hoc filters to write filters for existing queries.

> **Note:** Ad hoc filter variables only work with  InfluxDB, Prometheus, and Elasticsearch data sources.

## Enter General options

1. Navigate to the dashboard you want to make a variable for and then click the **Dashboard settings** (gear) icon at the top of the page.
1. On the Variables tab, click **New**.
1. Enter a **Name** for your variable.
1. In the **Type** list, select **Ad hoc filters**.
1. (optional) In **Label**, enter the display name of the variable dropdown. If you don't enter a display name, then the dropdown label will be the variable name.
1. Choose a **Hide** option:
   - **No selection (blank) -** The variable dropdown displays the variable **Name** or **Label** value. This is the default.
   - **Label -** The variable dropdown only displays the selected variable value and a down arrow.
   - **Variable -** No variable dropdown is displayed on the dashboard.

## Enter Options

1. In the **Data source** list, select the target data source. For more information about data sources, refer to [Add a data source]({{< relref "../../features/datasources/add-a-data-source.md" >}}).
1. Click **Add** to add the variable to the dashboard.

## Create ad hoc filters

Ad hoc filters are one of the most complex and flexible variable options available. Instead of a regular list of variable options, this variable allows you to build a dashboard-wide ad hoc query. Filters you apply in this manner are applied to all panels on the dashboard.