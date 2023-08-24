---
aliases:
- ../features/datasources/add-a-data-source/
title: Add data source
weight: 100
---

# Add a data source

Before you can create your first dashboard, you need to add your data source.

> **Note:** Only users with the organization Admin role can add data sources.

1. Move your cursor to the cog on the side menu which will show you the configuration menu. If the side menu is not visible click the Grafana icon in the upper left corner. Click on **Configuration** > **Data sources** in the side menu and you'll be taken to the data sources page
   where you can add and edit data sources. You can also click the cog.
{{< figure src="/static/img/docs/v52/sidemenu-datasource.png" max-width="250px" class="docs-image--no-shadow">}}

1. Move your cursor to the cog icon on the side menu which will show the configuration options.

    {{< figure src="/static/img/docs/v75/sidemenu-datasource-7-5.png" max-width="150px" class="docs-image--no-shadow">}}

1. Click on **Data Sources**. The data sources page opens showing a list of previously configured data sources for the Grafana instance.

1. Click **Add data source** to see a list of all supported data sources.

    {{< figure src="/static/img/docs/v75/add-data-source-7-5.png" max-width="600px" class="docs-image--no-shadow">}}

1. Search for a specific data source by entering the name in the search dialog. Or you can scroll through supported data sources grouped into time series, logging, tracing and other categories.

1. Move the cursor over the data source you want to add.

    {{< figure src="/static/img/docs/v75/select-data-source-7-5.png" max-width="700px" class="docs-image--no-shadow">}}

1. Click **Select**. The data source configuration page opens.

1. Configure the data source following instructions specific to that data source. See [Data sources]({{< relref "_index.md" >}}) for links to configuration instructions for all supported data sources.



