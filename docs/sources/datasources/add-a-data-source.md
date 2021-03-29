+++
title = "Add data source"
aliases = ["/docs/grafana/latest/features/datasources/add-a-data-source/"]
weight = 100
+++

# Add a data source

Before you create your first dashboard, add your data source.

> **Note:** Only users with the organization Admin role can add data sources.

To add a data source:

1. Move your cursor to the cog on the side menu which will show you the configuration menu.
   
{{< docs-imagebox img="/img/docs/v75/sidemenu-datasource.png" max-width="150px" class="docs-image--no-shadow">}}

1. Click on **Data Sources**. The data sources page opens showing a list of previously configured data sources for the Grafana instance.

{{< docs-imagebox img="/img/docs/v52/sidemenu-datasource.png" max-width="175px" class="docs-image--no-shadow">}}

1. Click **Add data source** to open the choose a data source type page. 
   
2. You can search for the data source by entering the data source name in the search dialog. Or you can scroll through supported data sources grouped into time series, logging, tracing and other groups.

    {{< docs-imagebox img="/img/docs/v52/add-datasource.png" max-width="700px" class="docs-image--no-shadow">}}

3. In the **Name** box, enter a name for this data source.

    {{< docs-imagebox img="/img/docs/v52/datasource-settings.png" max-width="700px" class="docs-image--no-shadow">}}

4. In the **Type**, select the type of data source. See [Supported data sources]({{< relref "_index.md#supported-data-sources" >}}) for more information and how to configure your data source settings.

5. Click **Save & Test**.

