+++
title = "Add a data source"
type = "docs"
[menu.docs]
name = "Add a data source"
identifier = "add_data_source"
parent = "features"
weight = 2
+++

# Add a data source

Before you create your first dashboard, you need to add your data source. Following are the list of instructions to create one.

> **Note:** Only users with the organization Admin role can add data sources.

1. Move your cursor to the cog on the side menu which will show you the configuration menu. If the side menu is not visible click the Grafana icon in the upper left corner. Click on **Configuration** > **Data Sources** in the side menu and you'll be taken to the data sources page
   where you can add and edit data sources. You can also click the cog.
{{< docs-imagebox img="/img/docs/v52/sidemenu-datasource.png" max-width="250px" class="docs-image--no-shadow">}}

1. Click **Add data source** and you will come to the settings page of your new data source.

    {{< docs-imagebox img="/img/docs/v52/add-datasource.png" max-width="700px" class="docs-image--no-shadow">}}

1. In the **Name** box, enter a name for this data source. 

    {{< docs-imagebox img="/img/docs/v52/datasource-settings.png" max-width="700px" class="docs-image--no-shadow">}}

1. In the **Type**, select the type of data source. See [Supported data sources]({{< relref "../../features/datasources/#supported-data-sources/" >}}) for more information and how to configure your data source settings.

1. Click **Save & Test**.
