---
aliases:
  - ../../reference/share_dashboard/ # /docs/grafana/next/reference/share_dashboard/
  - ../../reference/share_panel/ # /docs/grafana/next/reference/share_panel/
  - ../../share-dashboards-panels/ # /docs/grafana/next/share-dashboards-panels/
  - ../../sharing/ # /docs/grafana/next/sharing/
  - ../../sharing/playlists/ # /docs/grafana/next/sharing/playlists/
  - ../../sharing/share-dashboard/ # /docs/grafana/next/sharing/share-dashboard/
  - ../../sharing/share-panel/ # /docs/grafana/next/sharing/share-panel/
  - ../../visualizations/dashboards/share-dashboard/ # /docs/grafana/next/visualizations/dashboards/share-dashboard/
  - ../../visualizations/dashboards/share-dashboards-panels/ # /docs/grafana/next/visualizations/dashboards/share-dashboards-panels/
keywords:
  - grafana
  - dashboard
  - documentation
  - share
  - panel
  - reporting
  - export
  - pdf
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Sharing
title: Share dashboards and panels
description: Share Grafana dashboards and panels within your organization and publicly
weight: 650
---

# Share dashboards and panels

Grafana enables you to share dashboards and panels with other users within your organization and in certain situations, publicly on the web. You can share using:

- Direct links with users in and outside of your organization
- Snapshots
- Embeds
- PDFs
- PNG image files
- JSON files
- Reports
- Library panels

You must have an authorized viewer permission to see an image rendered by a direct link. The same permission is also required to view embedded links unless you have anonymous access permission enabled for your Grafana instance.

{{< admonition type="note" >}}
Anonymous access permission is not available in Grafana Cloud. This feature is only supported for Grafana Enterprise and Grafana Open Source.
{{< /admonition >}}

## Share dashboards {#share-a-dashboard}

You can share dashboards in the following ways:

- [Internally with a link](#share-an-internal-link)
- [Externally with anyone or specific people](#share-an-external-link)
- [As a report](#schedule-a-report)
- [As a snapshot](#share-a-snapshot)
- [As a PDF export](#export-a-dashboard-as-pdf)
- [As a JSON file export](#export-a-dashboard-as-code)
- [As an image export](#export-a-dashboard-as-an-image)

When you share a dashboard externally as a link or by email, those dashboards are included in a list of your shared dashboards. To view the list and manage these dashboards, navigate to **Dashboards > Shared dashboards**.

{{< admonition type="note" >}}
If you change a dashboard, ensure that you save the changes before sharing.
{{< /admonition >}}

### Share an internal link

To share a customized, direct link to your dashboard within your organization, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share internally**.
1. (Optional) In the **Share internally** drawer that opens, set the following options:
   - **Lock time range** - Change the current relative time range to an absolute time range. This option is enabled by default.
   - **Shorten link** - Shorten the dashboard link. This option is enabled by default.
1. Select the theme for the dashboard. Choose from **Current**, **Dark**, or **Light**.
1. Click **Copy link**.
1. Send the copied link to a Grafana user with authorization to view the link.
1. Click the **X** at the top-right corner to close the share drawer.

#### Quick-share an internal link

Once you've customized an internal link, you can share it quickly by following these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** button, not the drop-down list icon, to copy a shortened link.

This link has any customizations, like time range locking or theme, that you've previously set. These are stored in the browser scope.

### Share an external link

Externally shared dashboards allow you to share your Grafana dashboard with anyone. This is useful when you want to make your dashboard available to the world without requiring access to your Grafana organization.

Learn how to configure and manage externally shared dashboards in [Externally shared dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/shared-dashboards/).

### Schedule a report

{{< admonition type="note" >}}
This feature is only available on Grafana Enterprise.
{{< /admonition >}}

To share your dashboard as a report, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Schedule a report**.
1. [Configure the report](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/create-reports/#create-a-report).
1. Depending on your schedule settings, you'll have different options at this step. Click either **Schedule send** or **Send now**.

You can also save the report as a draft.

To manage your reports, navigate to **Dashboards > Reporting > Reports**.

### Share a snapshot

A dashboard snapshot publicly shares a dashboard while removing sensitive data such as queries and panel links, leaving only visible metrics and series names. Anyone with the link can access the snapshot.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by Grafana Labs that enables you to publish dashboard snapshots to an external Grafana instance. Anyone with the link can view it. You can set an expiration time if you want the snapshot removed after a certain time period.

{{< admonition type=note >}}
The snapshots.raintank.io option is disabled by default in Grafana Cloud. You can update [your config file](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#external_enabled) to enable this functionality.
{{< /admonition >}}

To see the other snapshots shared from your organization, navigate to **Dashboards > Snapshots** in the main menu.

To share your dashboard with anyone as a snapshot, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share snapshot**.
1. In the **Share snapshot** drawer that opens, enter a descriptive title for the snapshot in the **Snapshot name** field.
1. Select one of the following expiration options for the snapshot:
   - **1 Hour**
   - **1 Day**
   - **1 Week**
   - **Never**
1. Click **Publish snapshot** or **Publish to snapshots.raintank.io**.

   Grafana generates the link of the snapshot. Note that you can't publish dashboard snapshots containing custom panels to snapshot.raintank.io.

1. Click **Copy link**, and share it either within your organization or publicly on the web.
1. Click the **X** at the top-right corner to close the share drawer.

#### Delete a snapshot

To delete existing snapshots, follow these steps:

1. Navigate to **Dashboards > Snapshots** in the main menu.
1. To confirm which snapshot you're about to delete, click **View** on the snapshot row.

   The URLs for panel and dashboard snapshots from the same dashboard look similar and viewing them first can help you distinguish them.

1. Click the red **x** next to the snapshot that you want to delete.

The snapshot is immediately deleted. You might need to clear your browser cache or use a private or incognito browser to confirm this.

## Export dashboards

In addition to sharing dashboards as links, reports, and snapshots, you can export them as PDFs or JSON files.

### Export a dashboard as PDF

{{< admonition type="note" >}}
This feature is only available on Grafana Enterprise.
{{< /admonition >}}

To export a dashboard in its current state as a PDF, follow these steps:

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to export.
1. Click the **Export** drop-down in the sidebar and select **Export as PDF**.
1. In the **Export dashboard PDF** drawer that opens, select either **Landscape** or **Portrait** for the PDF orientation.
1. Select either **Grid** or **Simple** for the PDF layout.
1. Set the **Zoom** level; zoom in to enlarge text, or zoom out to see more data (like table columns) per panel.
1. Click **Generate PDF**.

   The PDF opens in another tab where you can download it.

1. Click the **X** at the top-right corner to close the share drawer.

### Export a dashboard as code

Export a Grafana JSON file that contains everything you need, including layout, variables, styles, data sources, queries, and so on, so that you can later import the dashboard.
To export a JSON file, follow these steps:

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to export.
1. Click the **Export** drop-down list in the sidebar and select **Export as code**.

   The **Export dashboard** drawer opens.

1. (Optional) Click **Advanced options** to expand the section and choose whether the dashboard export is in **JSON** or **YAML**.
1. (Optional) Toggle the **Share dashboard with another instance** switch to remove details specific to your Grafana instance.
1. Click **Download file** or **Copy to clipboard**.
1. Click the **X** at the top-right corner to close the share drawer.

The generated file uses one of the following schema models:

- **V1 Resource** - For dashboards created using the [current dashboard schema](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/view-dashboard-json-model/) wrapped in the `spec` property of the [V1 Kubernetes-style resource](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2alpha1).
- **V2 Resource** - For dashboards created using the [V2 Resource schema](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2beta1).

### Export a dashboard as an image

{{< admonition type="note">}}
You must have the [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer/) installed to export a dashboard as an image.
{{< /admonition >}}

To export a dashboard in its current state as a PNG image file, follow these steps:

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to export.
1. Click the **Export** drop-down list in the sidebar and select **Export as image**.

   The **Export as image** drawer opens.

1. Click **Generate image**.

   The image preview is displayed.

1. Click **Download image**.
1. Click the **X** at the top-right corner to close the share drawer.

The generated image reflects how the dashboard appears in your browser.
To change it, make changes to the dashboard or browser, like zooming in or out or resizing.

## Share panels {#share-a-panel}

You can share a panels in the following ways:

- [Internally with a link](#share-an-internal-link)
- [As an embed](#share-an-embed)
- [As a snapshot](#panel-snapshot)

{{< admonition type="note" >}}
If you change a panel, ensure that you save the changes before sharing.
{{< /admonition >}}

### Share an internal link

To share a personalized, direct link to your panel within your organization, follow these steps:

1. Hover over any part of the panel you want to share to display the actions menu on the top right corner.
1. Click the menu and select **Share link**.
1. (Optional) In the **Link settings** drawer that opens, set the following options:
   - **Lock time range** - Change the current relative time range to an absolute time range. This option is enabled by default.
   - **Shorten link** - Shorten the panel link. This option is disabled by default.
1. Select the theme for the dashboard. Choose from **Current**, **Dark**, or **Light**.
1. Click **Copy link**.
1. Send the copied link to a Grafana user with authorization to view it.
1. (Optional) To [generate an image of the panel as a PNG file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/), customize the image settings:
   - **Width** - In pixels. The default is 1000.
   - **Height** - In pixels. The default is 500.
   - **Scale factor** - The default is 1.

   There are maximums for [width](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#viewport-maximum-width), [height](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#viewport-maximum-height), and [scale factor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#maximum-device-scale-factor) in the image renderer configuration that you can customize if needed.

1. (Optional) Click **Generate image** to see a preview of the panel image.
1. (Optional) Click **Download image**.
1. Send the copied image to a Grafana user with authorization to view it.
1. Click the **X** at the top-right corner to close the share drawer.

#### Query string parameters for server-side rendered images

When you click **Generate image** in the panel link settings, Grafana generates a PNG image of the panel with the following default parameters:

| Parameter | Description                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| width     | Width in pixels. Default is 1000.                                                                                              |
| height    | Height in pixels. Default is 500.                                                                                              |
| tz        | Timezone in the format `UTC%2BHH%3AMM` where HH and MM are offset in hours and minutes after UTC.                              |
| timeout   | Number of seconds. The timeout can be increased if the query for the panel needs more than the default 30 seconds.             |
| scale     | Numeric value to configure device scale factor. Default is 1. Use a higher value to produce more detailed images (higher DPI). |

{{< admonition type="note" >}}
The image renderer enforces minimum width and height requirements. You can customize these minimums in self-managed Grafana installations through the [image renderer configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#configuration). In Grafana Cloud, the configuration is managed by Grafana and can't be modified. If you encounter size-related errors when rendering images using the API, ensure your dimensions meet the minimum requirements.
{{< /admonition >}}

You can also update these parameters in the [image rendering configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#configuration).

The following example shows a link to a server-side rendered PNG:

```bash
https://play.grafana.org/render/d-solo/ktMs4D6Mk?from=2024-09-03T11:55:44.442Z&to=2024-09-03T17:55:44.442Z&panelId=panel-13&__feature.dashboardScene&width=1000&height=500&tz=UTC
```

### Share an embed

You can share a panel by embedding it on another website using an iframe. Users must be signed into Grafana to view the panel unless you have anonymous access permission enabled for your Grafana instance.

{{< admonition type="note" >}}
Panel embedding and anonymous access permissions are not available in Grafana Cloud, even for panels in [externally shared dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/shared-dashboards/). These capabilities are only supported in Grafana Enterprise and Grafana Open Source.
{{< /admonition >}}

To create a panel that can be embedded, follow these steps:

1. Hover over any part of the panel you want to share to display the actions menu on the top-right corner.
1. Click the menu and select **Share embed**.

   The **Share embed** drawer opens.

1. (Optional) Toggle the **Lock time range** switch to set whether the panel uses the current relative time range or an absolute time range. This option is enabled by default.
1. Select the theme for the dashboard. Choose from **Current**, **Dark**, or **Light**.
1. (Optional) Make any changes to the HTML that you need.
1. Click **Copy to clipboard**.
1. Paste the HTML code into your website code.
1. Click the **X** at the top-right corner to close the share drawer.

Here's an example of what the HTML code might look like:

```html
<iframe
  src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4"
  width="650"
  height="300"
  frameborder="0"
></iframe>
```

The result is an interactive Grafana visualization embedded in an iframe.

### Share a snapshot {#panel-snapshot}

A panel snapshot shares an interactive panel publicly while removing sensitive data such as queries and panel links, leaving only visible metrics and series names. Anyone with the link can access the snapshot.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by Grafana Labs that enables you to publish dashboard snapshots to an external Grafana instance. Anyone with the link can view it. You can set an expiration time if you want the snapshot removed after a certain time period.

{{< admonition type=note >}}
The snapshots.raintank.io option is disabled by default in Grafana Cloud. You can update [your config file](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#external_enabled) to enable this functionality.
{{< /admonition >}}

To see the other snapshots shared from your organization, navigate to **Dashboards > Snapshots** in the main menu.

To share your panel with anyone as a snapshot, follow these steps:

1. Hover over any part of the panel you want to share to display the actions menu on the top-right corner.
1. Click the menu and select **Share snapshot**.
1. In the **Share snapshot** drawer that opens, enter a descriptive title for the snapshot in the **Snapshot name** field.
1. Select one of the following expiration options for the snapshot:
   - **1 Hour**
   - **1 Day**
   - **1 Week**
   - **Never**
1. Click **Publish snapshot** or **Publish to snapshots.raintank.io**.

   Grafana generates the link of the snapshot. Note that you can't publish snapshots that include custom panels to snapshot.raintank.io.

1. Click **Copy link**, and share it either within your organization or publicly on the web.
1. Click the **X** at the top-right corner to close the share drawer.

#### Delete a snapshot

To delete existing snapshots, follow these steps:

1. Navigate to **Dashboards > Snapshots** in the main menu.
1. To confirm which snapshot you're about to delete, click **View** on the snapshot row.

   The URLs for panel and dashboard snapshots from the same dashboard look similar and viewing them first can help you distinguish them.

1. Click the red **x** next to the snapshot URL that you want to delete.

The snapshot is immediately deleted. You may need to clear your browser cache or use a private or incognito browser to confirm this.
