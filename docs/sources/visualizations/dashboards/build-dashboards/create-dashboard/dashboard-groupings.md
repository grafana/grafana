---
aliases:
keywords:
  - panel
  - dashboard
  - create
  - dynamic dashboard
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Dashboard groupings
description: Group dashboard panels
weight: 300
---

# Panel groupings

<!--should this be dashboard groupings -->

To help create meaningful sections in your dashboard, you can group panels into rows or tabs.
Rows and tabs let you break up big dashboards or make one dashboard out of several smaller ones.

You can think of the dashboard as a series of nested containers: the dashboard is the largest container and it contains panels, rows, or tabs.
Rows and tabs are the next largest containers, and they contain panels or other rows and tabs.

You can nest:

- Rows in a row
- Rows in a tab
- Tabs in a row

You can nest up to three levels deep, which means a dashboard can have a maximum of five configuration levels:

- Dashboard
- Grouping 1 - Row or tab
- Grouping 2 - Row or tab
- Grouping 3 - Row or tab
- Panels

You can only have one type of grouping at each level.
Inside of those groupings however, you have the freedom to add different dashboard elements.
Also, you can have different panel layouts in within a row or tab. 
For example, in a dashboard with two rows, one row can have a custom layout and the other can have an auto layout.

<!-- {{< figure src="/media/docs/grafana/dashboards/screenshot-groupings-v12.4.png" alt="Dashboard with nested groupings" max-width="750px" >}} -->

In addition to the option to add groupings from the sidebar, when you hover your cursor over relevant parts of the dashboard, **+ Add panel**,  **+ New row**, **+ New tab**, **Group panels**, and ungroup buttons are visible.

The following sections describe:

- [Grouping configuration options](#grouping-configuration-options)
- [Grouping layouts](#grouping-layouts)
- [How to group panels](#group-panels)
- [How to ungroup panels](#ungroup-panels)

## Grouping configuration options

The following table describes the options you can set for a row or tab:

<!-- prettier-ignore-start -->

| Option          | Description                                                                 |
| ----------------| --------------------------------------------------------------------------- |
| Title           | Title of the row or tab.                                                    |
| Fill screen     | Toggle the switch on to make the row fill the screen. Rows only. |
| Hide row header | Toggle the switch on to hide row headers in view mode. In edit mode, the row header is visible, but crossed out with the hidden icon next to it. Rows only. |
| Layout          | Select the layout. If the grouping contains another grouping, choose from **Rows** or **Tabs**. If the grouping contains panels, choose from **Custom** or **Auto grid**. For more information, refer to [Panel layouts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#panel-layouts) or [Grouping layouts](#grouping-layouts). |
| Repeat options > [Repeat by variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#configure-repeat-options) | Configure the dashboard to dynamically add panels, rows, or tabs based on the value of a variable. |
| Show / hide rules > [Panel/Row/Tab visibility](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#configure-showhide-rules) | Control whether or not panels, rows, or tabs are displayed based on variable values, a time range, or query results (panels only). |

<!-- prettier-ignore-end -->

## Grouping layouts

When you have panels grouped into rows or tabs, the **Layout** options available depend on which dashboard element is selected and the nesting level of that element.

You can nest up to three levels deep, which means a dashboard can have a maximum of five configuration levels, with the following layout options:

- **Dashboard**: Layout options allow you to choose between rows and tabs or custom and auto layouts.
- **Grouping 1 (outer)**: Layout options allow you to choose between rows and tabs.
- **Grouping 2 (middle)**: Layout options allow you to choose between rows and tabs.
- **Grouping 3 (inner)**: Layout options allow you to choose between custom and auto grid (refer to [Panel layouts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#panel-layouts)).
- **Panels**: No layout options

You can switch between rows and tabs or update the panel layout by clicking the parent container and changing the layout selection.

## Group panels

To group panels already on a dashboard, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Do one of the following:

   - Click the **Add new element** icon (blue plus sign) and select **Group into rows** or **Group into tabs**.
   - Under a panel or group of panels, hover your mouse to reveal the **Group panels** button, click it and select **Group into row** or **Group into tab**.

   All the panels are moved into the grouping, and a dotted blue line surrounds the row or tab.
   The sidebar opens, displaying the relevant options.

   {{< admonition type="tip" >}}
   While grouping is typically used for multiple panels, you can start a grouping with just one panel.
   {{< /admonition >}}

1. Set the [grouping configuration options](#grouping-configuration-options) in the sidebar.
1. (Optional) Add one or both of the following:
   - Other [groupings at the same level](#add-more-groupings-at-the-same-level).
   - A [nested grouping](#add-nested-groupings)

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

You can also start a grouping by adding a row or tab from the sidebar and then adding panels to that grouping.

### Add more groupings at the same level

To add more groupings at the same level, follow these steps:

1. Click the dashboard or grouping level where you want to more groupings, and click **+ New row** or **+ New tab** (only one option will be available).

   {{< figure src="/media/docs/grafana/dashboards/screenshot-add-group-v12.4.png" alt="Adding a nested grouping" max-width="500px" >}}
   <!-- new screenshot -->

1. Set the configuration options for the new grouping.
1. Click **+ Add panel** to begin adding panels to the new grouping.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

### Add nested groupings

To add a nested grouping, follow these steps:

1. Click the grouping level where you want to add the nested grouping.
1. Do one of the following:

   - Click the **Add new element** icon (blue plus sign) and select **Group into rows** or **Group into tabs**.
   - Under a panel or group of panels in the grouping, click **Group panels** and select **Group into row** or **Group into tab** (**Group into tab** is only available if the parent grouping is a row).

   {{< figure src="/media/docs/grafana/dashboards/screenshot-nest-group-v12.4.png" alt="Adding a nested grouping" max-width="500px" >}}
   <!-- new screenshot here -->

   The new grouping is added inside the first grouping, and the panels are moved into the nested grouping.
   The sidebar opens displaying the relevant configuration options.

1. Set the configuration options for the nested grouping.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

You can add more one more level of grouping if needed.

## Ungroup panels

You can ungroup some or all of the dashboard groupings without losing your panels.

When you ungroup a row or tab, all the groupings inside it are ungrouped and the panels are moved into the next higher-level grouping.
If there are no more groupings left, the panels are moved onto the dashboard.

{{< figure src="/media/docs/grafana/dashboards/screenshot-ungrouping-v12.4.png" alt="Dashboard with ungrouping behavior annotated" max-width="750px" >}}

The **Ungroup rows** and **Ungroup tabs** buttons are only visible when you hover your mouse over the relevant part of the dashboard

{{< admonition type="caution" >}}
If you delete a grouping, rather than ungrouping it, its panels are deleted as well.
{{< /admonition >}}

To remove groupings, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. (Optional) Click the **Content outline** icon to quickly navigate to the grouping you want to remove.
1. Hover your mouse over the relevant area to show the **Ungroup rows** or **Ungroup tabs** button, then click it to ungroup all rows or tabs, including any nested groupings.
1. If you've ungrouped panels that were previously in different panel layouts, you'll be prompted to select a common layout type for all the panels; click **Convert to Auto grid** or **Convert to Custom**.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Place panels outside of groupings with headerless rows

If you have a panel that includes grouped panels already and you want some panels to appear ungrouped, you can use the **Hide row header** switch in the row configuration to achieve this.

In view mode, the row header is hidden, so that the panels in that row appear ungrouped.
In the following image, the panels are grouped into two rows, but the header of the second row is hidden:

{{< figure src="placeholder-1.png" max-width="750px" alt="Dashboard including a row with a hidden header" >}}
