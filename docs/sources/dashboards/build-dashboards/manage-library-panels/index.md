---
aliases:
  - ../../panels/library-panels/
  - ../../panels/library-panels/add-library-panel/
  - ../../panels/library-panels/create-library-panel/
  - ../../panels/library-panels/delete-library-panel/
  - ../../panels/library-panels/manage-library-panel/
  - ../../panels/library-panels/unlink-library-panel/
  - ../../panels/panel-library/
  - ../manage-library-panels/
menuTitle: Manage library panels
title: Manage library panels
weight: 300
---

# Manage library panels

A library panel is a reusable panel that you can use in any dashboard. When you make a change to a library panel, that change propagates to all instances of where the panel is used. Library panels streamline reuse of panels across multiple dashboards.

You can save a library panel in a folder alongside saved dashboards.

## Create a library panel

When you create a library panel, the panel on the source dashboard is converted to a library panel as well. You need to save the original dashboard once a panel is converted.

1. Open a panel in edit mode.
1. In the panel display options, click the down arrow option to bring changes to the visualization.
   {{< figure src="/static/img/docs/library-panels/create-lib-panel-from-edit-8-0.png" class="docs-image--no-shadow" max-width= "800px" caption="Screenshot of the edit panel" >}}
1. Click the **Library panels** option, and then click **Create library panel** to open the create dialog.
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder to save the library panel.
1. Click **Create library panel** to save your changes.
1. Save the dashboard.

Once created, you can modify the library panel using any dashboard on which it appears. After you save the changes, all instances of the library panel reflect these modifications.

{{< figure src="/static/img/docs/library-panels/create-from-more-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the edit panel" >}}

## Add a library panel to a dashboard

Add a Grafana library panel to a dashboard when you want to provide visualizations to other dashboard users.

1. Click **Dashboards** in the left-side menu.
1. Click **New** and select **New Dashboard**.
1. On the empty dashboard, click **+ Import library panel**.

   You will see a list of your library panels.

1. Filter the list or search to find the panel you want to add.
1. Click a panel to add it to the dashboard.

## Unlink a library panel

Unlink a library panel when you want to make a change to the panel and not affect other instances of the library panel.

1. Click **Dashboards** in the left-side menu.
1. Click **Library panels**.
1. Select a library panel that is being used in different dashboards.
1. Select the panel you want to unlink.
1. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.
1. Click **Unlink** on the top right corner of the page.

## View a list of library panels

You can view a list of available library panels and search for a library panel.

1. Click **Dashboards** in the left-side menu.
1. Click **Library panels**.

   You can see a list of previously defined library panels.
   {{< figure src="/static/img/docs/library-panels/library-panel-list-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the edit panel" >}}

1. Search for a specific library panel if you know its name.

   You can also filter the panels by folder or type.

## Delete a library panel

Delete a library panel when you no longer need it.

1. Click **Dashboards** in the left-side menu.
1. Click **Library panels**.
1. Click the delete icon next to the library panel name.
