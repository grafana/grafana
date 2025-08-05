---
aliases:
  - ../administration/reports/
  - ../enterprise/export-pdf/
  - ../enterprise/reporting/
  - ../reference/share_dashboard/
  - ../reference/share_panel/
  - ../share-dashboards-panels/
  - ../sharing/
  - ../sharing/playlists/
  - ../sharing/share-dashboard/
  - ../sharing/share-panel/
  - ./
  - reporting/
  - share-dashboard/
keywords:
  - grafana
  - dashboard
  - documentation
  - share
  - panel
  - library panel
  - playlist
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
weight: 700
refs:
  image-rendering:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
---

# Share dashboards and panels

Grafana enables you to share dashboards and panels with other users within an organization and in certain situations, publicly on the Web. You can share using:

- A direct link
- A Snapshot
- An embedded link (for panels only)
- An export link (for dashboards only)

You must have an authorized viewer permission to see an image rendered by a direct link.

The same permission is also required to view embedded links unless you have anonymous access permission enabled for your Grafana instance.

{{< admonition type="note" >}}
As of Grafana 8.0, anonymous access permission is not available in Grafana Cloud. This feature is only supported for Grafana Enterprise and Grafana Open Source.
{{< /admonition >}}

When you share a panel or dashboard as a snapshot, a snapshot (which is a panel or dashboard at the moment you take the snapshot) is publicly available on the web. Anyone with a link to it can access it. Because snapshots do not require any authorization to view, Grafana removes information related to the account it came from, as well as any sensitive data from the snapshot.

## Share a dashboard

You can share a dashboard as a direct link or as a snapshot. You can also export a dashboard.

{{< admonition type="note" >}}
If you change a dashboard, ensure that you save the changes before sharing.
{{< /admonition >}}

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click **Share** in the top-right corner.

   The share dialog opens and shows the Link tab.

### Share a direct link

The **Link** tab shows the current time range, template variables, and the default theme. You can also share a shortened URL.

1. Click **Copy**.

   This action copies the default or the shortened URL to the clipboard.

1. Send the copied URL to a Grafana user with authorization to view the link.

### Publish a snapshot

A dashboard snapshot shares an interactive dashboard publicly. Grafana strips sensitive data such as queries (metric, template and annotation) and panel links, leaving only the visible metric data and series names embedded in the dashboard. Dashboard snapshots can be accessed by anyone with the link.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by Grafana Labs that enables you to publish dashboard snapshots to an external Grafana instance. Anyone with the link can view it. You can set an expiration time if you want the snapshot removed after a certain time period.

1. Click the **Snapshot** tab.
1. Click **Publish to snapshots.raintank.io** or **Publish Snapshot**.

   Grafana generates a link of the snapshot.

1. Copy the snapshot link, and share it either within your organization or publicly on the web.

If you created a snapshot by mistake, click **Delete snapshot** in the dialog box to remove the snapshot from your Grafana instance.

#### Delete a snapshot

To delete existing snapshots, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **Snapshots** to go to the snapshots management page.
1. Click the red **x** next to the snapshot URL that you want to delete.

The snapshot is immediately deleted. You may need to clear your browser cache or use a private or incognito browser to confirm this.

### Export a dashboard as JSON

The dashboard export action creates a Grafana JSON file that contains everything you need, including layout, variables, styles, data sources, queries, and so on, so that you can later import the dashboard.

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to export.
1. Click **Share** in the top-right corner.
1. Click **Export**.

   If you're exporting the dashboard to use in another instance, with different data source UIDs, enable the **Export for sharing externally** switch.

1. Click **Save to file**.

Grafana downloads a JSON file to your local machine.

#### Make a dashboard portable

If you want to export a dashboard for others to use, you can add template variables for things like a metric prefix (use a constant variable) and server name.

A template variable of the type `Constant` is automatically hidden in the dashboard, and is also added as a required input when the dashboard is imported.

## Export dashboard as PDF

You can generate and save PDF files of any dashboard.

{{< admonition type="note" >}}
Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud/).
{{< /admonition >}}

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click **Share** in the top-right corner.
1. On the **PDF** tab, select a layout option for the exported dashboard: **Portrait** or **Landscape**.
1. Click **Save as PDF** to render the dashboard as a PDF file.

   Grafana opens the PDF file in a new window or browser tab.

## Share a panel

You can share a panel as a direct link, as a snapshot, or as an embedded link. You can also create library panels using the **Share** option on any panel.

1. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Share**.

   The share dialog opens and shows the **Link** tab.

### Use direct link

The **Link** tab shows the current time range, template variables, and the default theme. You can optionally enable a shortened URL to share.

1. Click **Copy**.

   This action copies the default or the shortened URL to the clipboard.

1. Send the copied URL to a Grafana user with authorization to view the link.
1. You also optionally click **Direct link rendered image** to share an image of the panel.

For more information, refer to [Image rendering](ref:image-rendering).

The following example shows a link to a server-side rendered PNG:

```bash
https://play.grafana.org/d/000000012/grafana-play-home?orgId=1&from=1568719680173&to=1568726880174&panelId=4&fullscreen
```

#### Query string parameters for server-side rendered images

- **width:** Width in pixels. Default is 800.
- **height:** Height in pixels. Default is 400.
- **tz:** Timezone in the format `UTC%2BHH%3AMM` where HH and MM are offset in hours and minutes after UTC
- **timeout:** Number of seconds. The timeout can be increased if the query for the panel needs more than the default 30 seconds.
- **scale:** Numeric value to configure device scale factor. Default is 1. Use a higher value to produce more detailed images (higher DPI). Supported in Grafana v7.0+.

### Publish a snapshot

A panel snapshot shares an interactive panel publicly. Grafana strips sensitive data leaving only the visible metric data and series names embedded in the dashboard. Panel snapshots can be accessed by anyone with the link.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by [Grafana Labs](https://grafana.com), that enables you to publish dashboard snapshots to an external Grafana instance.

{{< admonition type="note" >}}
As of Grafana 11, the option to publish to [snapshots.raintank.io](http://snapshots.raintank.io) is no longer available for Grafana Cloud.
{{< /admonition >}}

You can optionally set an expiration time if you want the snapshot to be removed after a certain time period.

1. In the **Share Panel** dialog, click **Snapshot** to go to the tab.
1. Click **Publish to snapshots.raintank.io** or **Publish Snapshot**.

   Grafana generates the link of the snapshot.

1. Copy the snapshot link, and share it either within your organization or publicly on the web.

If you created a snapshot by mistake, click **Delete snapshot** in the dialog box to remove the snapshot from your Grafana instance.

#### Delete a snapshot

To delete existing snapshots, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click **Snapshots** to go to the snapshots management page.
1. Click the red **x** next to the snapshot URL that you want to delete.

The snapshot is immediately deleted. You may need to clear your browser cache or use a private or incognito browser to confirm this.

### Embed panel

You can embed a panel using an iframe on another web site. A viewer must be signed into Grafana to view the graph unless you have anonymous access permission enabled for your Grafana instance.

{{< admonition type="note" >}}
Panel embedding and anonymous access permissions are not available in Grafana Cloud, even for panels in [public dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/dashboard-public/). These capabilities are only supported in Grafana Enterprise and Grafana Open Source.
{{< /admonition >}}

Here is an example of the HTML code:

```html
<iframe
  src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4"
  width="650"
  height="300"
  frameborder="0"
></iframe>
```

The result is an interactive Grafana graph embedded in an iframe.

### Library panel

To create a library panel from the **Share Panel** dialog:

1. Click **Library panel**.
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder in which to save the library panel. By default, the root level is selected.
1. Click **Create library panel** to save your changes.
1. Click **Save dashboard**.
