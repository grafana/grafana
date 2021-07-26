+++
title = "Library panels"
weight = 410
+++

# Library panels

Library panels allow users to create reusable panels where any changes made to one instance of the library panel is reflected on every dashboard affecting all other instances where the panel is used. These panels can be saved in folders alongside Dashboards and streamline reuse of panels across multiple dashboards.

## Create a library panel

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

## Add a library panel

To add a library panel to a dashboard:

1. Hover over the **+** option on the left menu, then select **Create** from the drop down options. The Add panel dialog opens.
   {{< figure src="/static/img/docs/library-panels/add-library-panel-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the edit panel" >}}
1. Click the **Add a panel from the panel library** option. You will see a list of your library panels.
1. Filter the list or search to find the panel you want to add.
1. Click your desired panel and add it to the dashboard.

## Manage library panels

To view and manage existing library panels:

1. Hover over the **Dashboard** option on the left menu, then click **Library panels**. You can see a list of previously defined library panels.
   {{< figure src="/static/img/docs/library-panels/library-panel-list-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the edit panel" >}}
1. Search for a specific library panel if you know its name. You can also filter the panels by folder or type.

## Unlink a library panel

In case you have a library panel on your dashboard that want to modify it without affecting all other instances of the library panel, you can unlink the library panel.

To unlink a library panel from a dashboard:

1. Hover over **Dashboard** on the left menu, and then click **Library panels**.
1. Select a library panel that is being used in different dashboards. You will see a list of all the dashboards where the library panel is used.
   {{< figure src="/static/img/docs/library-panels/unlink-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the edit panel" >}}
1. Select the panel you want to unlink and update. 
1. Click the title of the panel and then click **Edit**. The panel opens in edit mode.
1. Click the **Unlink** option on the top right corner of the UI.

## Delete a library panel

Before you delete a library panel, verify that it is no longer in use on any dashboard.

To delete a library panel:

1. Hover over **Dashboard** on the left menu, and select Library panels from the drop down options.
1. Select a library panel that is being used in different dashboards. You will see a list of all the dashboards.
1. Select the panel you want to delete.
1. Click the delete icon next to the library panel name.
