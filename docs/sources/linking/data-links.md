---
aliases:
  - ../reference/datalinks/
keywords:
  - grafana
  - data links
  - documentation
  - playlist
title: Data links
---

# Data links

Data links allow you to provide more granular context to your links. You can create links that include the series name or even the value under the cursor. For example, if your visualization showed four servers, you could add a data link to one or two of them.

The link itself is accessible in different ways depending on the visualization. For the Graph you need to click on a data point or line, for a panel like
Stat, Gauge, or Bar Gauge you can click anywhere on the visualization to open the context menu.

You can use variables in data links to send people to a detailed dashboard with preserved data filters. For example, you could use variables to specify a time range, series, and variable selection. For more information, refer to [Data link variables]({{< relref "data-link-variables.md" >}}).

## Typeahead suggestions

When creating or updating a data link, press Cmd+Space or Ctrl+Space on your keyboard to open the typeahead suggestions to more easily add variables to your URL.

{{< figure src="/static/img/docs/data_link_typeahead.png"  max-width= "800px" >}}

## Add a data link

1. Hover your cursor over the panel that you want to add a link to and then press `e`. Or click the dropdown arrow next to the panel title and then click **Edit**.
1. On the Field tab, scroll down to the Data links section.
1. Expand Data links and then click **Add link**.
1. Enter a **Title**. **Title** is a human-readable label for the link that will be displayed in the UI.
1. Enter the **URL** you want to link to.

   You can even add one of the template variables defined in the dashboard. Click in the **URL** field and then type `$` or press Ctrl+Space or Cmd+Space to see a list of available variables. By adding template variables to your panel link, the link sends the user to the right context, with the relevant variables already set. For more information, refer to [Data link variables]({{< relref "data-link-variables.md" >}}).

1. If you want the link to open in a new tab, then select **Open in a new tab**.
1. Click **Save** to save changes and close the window.
1. Click **Save** in the upper right to save your changes to the dashboard.

## Update a data link

1. On the Field tab, find the link that you want to make changes to.
1. Click the Edit (pencil) icon to open the Edit link window.
1. Make any necessary changes.
1. Click **Save** to save changes and close the window.
1. Click **Save** in the upper right to save your changes to the dashboard.

## Delete a data link

1. On the Field tab, find the link that you want to delete.
1. Click the **X** icon next to the link you want to delete.
1. Click **Save** in the upper right to save your changes to the dashboard.
