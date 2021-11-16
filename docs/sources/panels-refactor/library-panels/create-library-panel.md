+++
title = "Create a Grafana library panel"
weight = 1
+++

# Create a Grafana library panel

Before you can use library panels, you have to create them.

> **Note:** When you create library panels, the panel on the source dashboard is converted to a library panel as well. You will need to save the original dashboard once a panel is converted.

To create a library panel:

1. Create a Grafana panel as you normally would, following instructions in [Add a panel]({{< relref "./add-a-panel.md" >}}). You an also use an existing panel.
1. Click the title of the panel and then click **Edit**. The panel opens in edit mode.
1. In the panel display options (side pane), click the down arrow option to bring changes to the visualization.
   {{< figure src="/static/img/docs/library-panels/create-lib-panel-from-edit-8-0.png" class="docs-image--no-shadow" max-width= "800px" caption="Screenshot of the edit panel" >}}
1. Click the **Library panels** option, and then click **Create new library panel** to open the create dialog.
   {{< figure src="/static/img/docs/library-panels/create-lib-panel-8-0.png" class="docs-image--no-shadow" max-width= "500px" caption="Screenshot of the create library panel dialog" >}}
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder to save the library panel. By default, the General folder is selected.
1. Click **Create library panel** to save your changes.
1. Save the dashboard.

Optionally, you can click title of the panel and then click **More > Create Library panel**. Next, follow the instructions Step 5 in the procedure above.

{{< figure src="/static/img/docs/library-panels/create-from-more-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the edit panel" >}}

Also, library panels can also be created using the “Share” option for any panel.

Once created, you can modify the library panel using any dashboard on which it appears. Once the library panel changes are saved, all instances of the library panel will reflect these modifications.

