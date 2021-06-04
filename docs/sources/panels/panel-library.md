+++
title = "Library panel"
weight = 400
+++

# Library panel

Library panels allow users to create reusable panels that aren’t tied to any one dashboard. As a result, any changes made to one instance of the library panel affecting all other instances.

## Create a library panel

To create a library panel:

1. Create a panel as you normally would, following instructions in [Add a panel]({{< relref "./add-a-panel.md" >}}).
1. Click the title of the panel and then click **Edit**. The panel opens in edit mode.
1. In the panel display options (side pane), click the down arrow option to bring changes to the visualization.
1. Click the **Library panels** option, and then click **Create new library panel**.
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder to save the library panel. By default, the General folder is selected.



1. Click the dashboard icon on the side menu, then select **Library panels** from the dropdown options.
1. 
. In the  

   ![](/static/img/docs/panels/add-panel-icon-7-0.png)

1. Choose from the options to specify a name for the new library panel, and the folder to save the library panel in.
1. Click **Save**.

Once created, you can modify the library panel.  can be modified, and once saved, all instances of the library panel will represent these modifications.

## Add a library panel

1. Click the **Add panel** option.  button, where you’ll be presented with a few options, one of which is “Add a panel from the panel library”. Choosing this option will present a list of your library panels that can be searched and filtered. Clicking your desired panel will then add it to the dashboard.


Choose a data source. In the first line of the Query tab, click the drop-down list to see all available data sources. This list includes all data sources you added. Refer to [Add a data source]({{< relref "../datasources/add-a-data-source.md" >}}) if you need instructions.
1. Write or construct a query in the query language of your data source. Options will vary. Refer to your specific [data source documentation]({{< relref "../datasources/_index.md" >}}) for specific guidelines.

## 3. Choose a visualization type

In the Visualization list, click a visualization type. Grafana displays a preview of your query results with that visualization applied.

![](/static/img/docs/panel-editor/select-visualization-8-0.png)

For more information about individual visualizations, refer to [Visualizations options]({{< relref "visualizations/_index.md" >}}).

## 4. (Optional) Edit panel settings

While not required, most visualizations need some adjustment before they properly display the information that you need. Options are defined in the linked topics below.

- [Panel options]({{< relref "./panel-options.md" >}})
- [Visualization-specific options]({{< relref "./visualizations/_index.md" >}})
- [Standard options]({{< relref "./standard-options.md" >}})
- [Thresholds]({{< relref "./thresholds.md" >}})
- [Value mappings]({{< relref "./value-mappings.md" >}})
- [Data links]({{< relref "../linking/data-links.md" >}})
- [Field overrides]({{< relref "./field-overrides.md" >}})

## 5. Apply changes and save

Save the dashboard. Either press Ctrl/Cmd+S or click **Save** in the upper right corner of the screen.

Your options vary depending on the changes you made and whether or not it is a new dashboard. We recommend you add a note to describe your changes before you click **Save**. Notes are very helpful if you need to revert the dashboard to a previous version.

## 
