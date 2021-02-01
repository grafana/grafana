+++
title = "Explore"
keywords = ["explore", "loki", "logs"]
aliases = ["/docs/grafana/latest/features/explore/"]
weight = 90
+++

# Explore

Grafana's dashboard UI is all about building dashboards for visualization. Explore strips away the dashboard and panel options so that you can focus on the query. It helps you iterate until you have a working query and then think about building a dashboard. 

If you just want to explore your data and do not want to create a dashboard, then Explore makes this much easier. If your data source supports graph and table data, then Explore shows the results both as a graph and a table. This allows you to see trends in the data and more details at the same time.

>**Note:** Explore is available in Grafana 6.0 and later versions.

Users with the Viewer role cannot edit and do not have access to Explore. Refer to [Organization roles](https://grafana.com/docs/grafana/latest/permissions/organization_roles/) for more information about what each role has access to.

To access Explore:

1. Click on the Explore icon on the menu bar. An empty Explore tab opens.
   ![Access Explore](/img/docs/explore/access-explore-7-4.png)
1. Choose your data source from the dropdown in the top left. [Prometheus](https://grafana.com/oss/prometheus/) has a custom Explore implementation, the other data sources use their standard query editor.
1. In the query field, write your query to explore your data. There are three buttons beside the query field, a clear button (X), an add query button (+) and the remove query button (-). Just like the normal query editor, you can add and remove multiple queries.

{{< docs-imagebox img="/img/docs/v65/explore_menu.png" class="docs-image--no-shadow" caption="Screenshot of the new Explore Icon" >}}

To start with an existing query in a panel, choose the Explore option from the Panel menu. This opens an Explore tab with the query from the panel and allows you to tweak or iterate in the query outside of your dashboard.

{{< docs-imagebox img="/img/docs/v65/explore_panel_menu.png" class="docs-image--no-shadow" caption="Screenshot of the new Explore option in the panel menu" >}}

## Split and compare

The split view feature is an easy way to compare graphs and tables side-by-side or to look at related data together on one page. Click the split button to duplicate the current query and split the page into two side-by-side queries. It is possible to select another data source for the new query which for example, allows you to compare the same query for two different servers or to compare the staging environment to the production environment.

{{< docs-imagebox img="/img/docs/v65/explore_split.png" class="docs-image--no-shadow" caption="Screenshot of the new Explore option in the panel menu" >}}

In split view, timepickers for both panels can be linked (if you change one, the other gets changed as well) by clicking on one of the time-sync buttons attached to the timepickers. Linking of timepickers helps with keeping the start and the end times of the split view queries in sync and it will ensure that you’re looking at the same time interval in both split panels.

You can close the newly created query by clicking on the Close Split button.

## Navigate between Explore and a dashboard

To help accelerate workflows that involve regularly switching from Explore to a dashboard and vice-versa, we've added the ability to return to the origin dashboard after navigating to Explore from the panel's dropdown.

{{< docs-imagebox img="/img/docs/v64/panel_dropdown.png" class="docs-image--no-shadow" caption="Screenshot of the panel dropdown" >}}

After you've navigated to Explore, you should notice a "Back" button in the Explore toolbar.

{{< docs-imagebox img="/img/docs/v64/explore_toolbar.png" class="docs-image--no-shadow" caption="Screenshot of the explore toolbar" >}}

Simply clicking the button will return you to the origin dashboard, or, if you'd like to bring changes you make in Explore back to the dashboard, simply click
the arrow next to the button to reveal a "Return to panel with changes" menu item.

{{< docs-imagebox img="/img/docs/v64/explore_return_dropdown.png" class="docs-image--no-shadow" caption="Screenshot of the expanded explore return dropdown" >}}

## Share shortened link

> **Note:** Available in Grafana 7.3 and later versions.

The Share shortened link capability allows you to create smaller and simpler URLs of the format /goto/:uid instead of using longer URLs containing complex query parameters. You can create a shortened link by clicking on the **Share** option in Explore toolbar. Please note that any shortened links that are never used will be automatically deleted after 7 days.
