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

<!--should this be dashboard groupings and should groupings live on their own page to give this page room to breathe -->

To help create meaningful sections in your dashboard, you can group panels into rows or tabs.
Rows and tabs let you break up big dashboards or make one dashboard out of several smaller ones.

You can think of the dashboard as a series of nested containers: the dashboard is the largest container and it contains panels, rows, or tabs.
Rows and tabs are the next largest containers, and they contain panels.

You can also nest:

- Rows in a row
- Rows in a tab
- Tabs in a row

You can nest up to two levels deep, which means a dashboard can have a maximum of four configuration levels:

- Dashboard
- Grouping 1 - Row or tab
- Grouping 2 - Row or tab
- Panels

You can only have one type of grouping at each level.
Inside of those groupings however, you have the freedom to add different dashboard elements.
Also, custom and auto grid panel layouts are supported for rows and tabs, so each grouping can have a different panel layout.

<!-- {{< figure src="/media/docs/grafana/dashboards/screenshot-groupings-v12.4.png" alt="Dashboard with nested groupings" max-width="750px" >}} -->

In addition to the option to add groupings from the sidebar, when you hover your cursor over relevant parts of the dashboard, **Add panel** and **Group panels** buttons are visible.
For tabs, actions like **Add tab** and **Ungroup tabs** are always visible on the tabs bar.

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
| Layout          | Select the layout. If the grouping contains another grouping, choose from **Rows** or **Tabs**. If the grouping contains panels, choose from **Custom** or **Auto grid**. For more information, refer to [Panel layouts](#panel-layouts) or [Grouping layouts](#grouping-layouts). |
| Repeat options > [Repeat by variable](#configure-repeat-options) | Configure the dashboard to dynamically add panels, rows, or tabs based on the value of a variable. |
| Show / hide rules > [Panel/Row/Tab visibility](#configure-showhide-rules) | Control whether or not panels, rows, or tabs are displayed based on variable values, a time range, or query results (panels only). |

<!-- prettier-ignore-end -->

## Grouping layouts

When you have panels grouped into rows or tabs, the **Layout** options available depend on which dashboard element is selected and the nesting level of that element.

You can nest up to two levels deep, which means a dashboard can have a maximum of four configuration levels, with the following layout options:

- **Dashboard**: Layout options allow you to choose between rows or tabs.
- **Grouping 1 (outer)**: Layout options allow you to choose between rows or tabs.
- **Grouping 2 (inner)**: Layout options allow you to choose between custom and auto grid (refer to [Panel layouts](#panel-layouts)).
- **Panels**: No layout options

You can switch between rows and tabs or update the panel layout by clicking the parent container and changing the layout selection.

## Group panels

To group panels, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. Under a panel, hover your mouse to reveal the **Group panels** button, then click it.

   While grouping is typically used for multiple panels, you can start a grouping with just one panel.

1. Select **Group into row** or **Group into tab**.

   All the panels are moved into the grouping, and a dotted blue line surrounds the row or tab.
   The sidebar opens, displaying the relevant options.

1. Set the [grouping configuration options](#grouping-configuration-options) in the sidebar.
1. (Optional) Add one or both of the following:
   - A [nested grouping](#add-nested-groupings)
   - Other [groupings at the same level](#add-more-groupings-at-the-same-level).

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

### Add nested groupings

To add a second-level (or nested) grouping, follow these steps:

1. In the existing grouping, under the panels, click **Group panels**.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-nest-group-v12.4.png" alt="Adding a nested grouping" max-width="500px" >}}

1. Click **Group into row** or **Group into tab** (**Group into tab** is only available if the parent grouping is a row).

   The new grouping is added inside the first grouping, and the panels are moved into the nested grouping.
   The sidebar opens displaying the relevant options.

1. Set the configuration options for the nested grouping.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

### Add more groupings at the same level

To add more first-level groupings, follow these steps:

1. On the dashboard, outside the existing first-level grouping, click **New row** or **New tab** (only one option will be available).

   {{< figure src="/media/docs/grafana/dashboards/screenshot-add-group-v12.4.png" alt="Adding a nested grouping" max-width="500px" >}}

1. Set the configuration options for the new grouping.
1. Click **+ Add panel** to begin adding panels.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Ungroup panels

You can ungroup some or all of the dashboard groupings without losing your panels.
Ungrouping behavior depends on whether you're working with first-level or nested groupings:

| Grouping   | Action and outcome                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Rows       | **Ungroup rows** ungroups all first-level rows in the dashboard and all of their nested groupings. |
| Tabs       | **Ungroup tabs** ungroups all first-level tabs in the dashboard and all of their nested groupings. |
| Row > row  | **Ungroup rows** ungroups the nested row.                                                          |
| Row > tabs | **Ungroup tabs** ungroups all the nested tabs in that row. Tabs in other rows are not affected.    |
| Tab > rows | **Ungroup rows** ungroups all the nested rows in that tab. Rows in other tabs are not affected.    |

{{< figure src="/media/docs/grafana/dashboards/screenshot-ungrouping-v12.4.png" alt="Dashboard with ungrouping behavior annotated" max-width="750px" >}}

The **Ungroup rows** and **Ungroup tabs** buttons are only visible when you hover your mouse over the relevant row or tab area.

{{< admonition type="caution" >}}
If you delete a grouping, rather than ungrouping it, its panels are deleted as well.
{{< /admonition >}}

To remove groupings, follow these steps:

1. Navigate to the dashboard you want to update.
1. Click **Edit**.
1. (Optional) Click the **Content outline** icon to quickly navigate to the grouping you want to remove.
1. Do one of the following:
   - Hover your mouse over the relevant area to show the **Ungroup rows** or **Ungroup tabs** button, then click it to ungroup all rows or tabs, including any nested groupings.
   - Hover and click in a grouping to show and click **Ungroup rows** or **Ungroup tabs** to ungroup only the tabs or rows nested in that grouping.

1. If you've ungrouped panels that were previously in different panel layouts, you'll be prompted to select a common layout type for all the panels; click **Convert to Auto grid** or **Convert to Custom**.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.