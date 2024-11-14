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
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Manage library panels
title: Manage library panels
description: Create reusable library panels that you can use in any dashboard
weight: 300
refs:
  rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/
---

# Manage library panels

A library panel is a reusable panel that you can use in any dashboard. When you make a change to a library panel, that change propagates to all instances of where the panel is used. Library panels streamline reuse of panels across multiple dashboards.

You can save a library panel in a folder alongside saved dashboards.

## Role-based access control

You can control permissions for library panels using [role-based access control (RBAC)](ref:rbac). RBAC provides a standardized way of granting, changing, and revoking access when it comes to viewing and modifying Grafana resources, such as dashboards, reports, and administrative settings.

## Create a library panel

Library panels can be reused in different dashboards throughout Grafana. When you create a library panel, the panel on the source dashboard is converted to a library panel as well. You need to save the original dashboard once a panel is converted.

To create a library panel, follow these steps:

1. In the top-right corner of the dashboard, click **Edit**.
1. Hover over any part of the panel you want to share to display the actions menu on the top right corner.
1. Click **More > New library panel**.
1. In the **Library panel name** field, enter the name.
1. In the **Save in folder** drop-down list, select the folder in which to save the library panel. By default, the root level is selected.
1. Click **Create library panel** to save your changes.
1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

Once created, you can modify the library panel using any dashboard on which it appears. After you save the changes, all instances of the library panel reflect these modifications.

## Add a library panel to a dashboard

Add a Grafana library panel to a dashboard when you want to provide visualizations to other dashboard users.

To add a library panel, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **New** and select **New Dashboard** in the drop-down list.
1. On the empty dashboard, click **+ Add library panel**.

   The **Add panel from panel library** drawer opens.

1. Filter the list or search to find the panel you want to add.
1. Click a panel to add it to the dashboard.
1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.

## Unlink a library panel

Unlink a library panel when you want to make a change to the panel and not affect other instances of the library panel.

To unlink a library panel, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **Library panels**.
1. Select a library panel that is being used in dashboards.
1. Click the panel you want to unlink.
1. In the dialog box, select the dashboard from which you want to unlink the panel.
1. Click **View panel in \<dashboard name\>**.
1. Click **Edit** in the top-right corner of the dashboard.
1. Hover over any part of the panel you want to unlink to display the menu icon on the top-right corner.
1. Click the menu icon and select **More > Unlink library panel**.
1. Click **Yes, unlink**.
1. Click **Save dashboard** and **Exit edit**.

Alternatively, if you know where the library panel is being used, you can go directly to that dashboard and start at step 7.

## Replace a library panel

To replace a library panel with a different one, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **Library panels**.
1. Select a library panel that is being used in different dashboards.
1. Click the panel you want to unlink.
1. In the dialog box, select the dashboard from which you want to unlink the panel.
1. Click **View panel in \<dashboard name\>**.
1. Click **Edit** in the top-right corner of the dashboard.
1. Hover over any part of the panel you want to unlink to display the menu icon on the top-right corner.
1. Click the menu icon and select **More > Replace library panel**.
1. Select the replacement library panel.
1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save** and **Exit edit**.

Alternatively, if you know where the library panel that you want to replace is being used, you can go directly to that dashboard and start at step 7.

## View a list of library panels

You can view a list of available library panels and see where those panels are being used.

To view and manage library panels, follow these steps:

1. Click **Dashboards > Library panels** in the main menu.

   You can see a list of previously defined library panels.
   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-library-panel-list-9-5.png" class="docs-image--no-shadow" max-width= "900px" alt="Library panels page with list of library panels" >}}

1. Search for a specific library panel if you know its name.

   You can also filter the panels by folder or type.

1. Click the panel to see if it's being used in any dashboards.
1. (Optional) If the library panel is in use, select one of the dashboards using it.
1. (Optional) Click **View panel in \<dashboard name\>** to see the panel in context.

## Delete a library panel

To delete a library panel that you no longer need, follow these steps:

1. Click **Dashboards > Library panels** in the main menu.
1. Click the delete icon next to the library panel name.
1. Click **Delete**.
