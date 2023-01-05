---
aliases:
  - ../dashboards/share-dashboard/
  - ../reference/share_panel/
keywords:
  - grafana
  - dashboard
  - documentation
  - sharing
  - library panel
title: Share a panel
weight: 6
---

# Share a panel

You can share a panel as a direct link, as a snapshot or as an embedded link. You can also create library panels using the “Share” option for any panel.

To share a panel:

1. Click a panel title to open the panel menu.
1. Click **Share**. The share dialog opens and shows the Link tab.

![Panel share direct link](/static/img/docs/sharing/share-panel-direct-link-8-0.png)

## Use direct link

The Link tab has the current time range, template variables and theme selected by default. You can optionally enable a shortened URL to share.

To share a direct link:

1. Click **Copy**. This copies the default or the shortened URL to the clipboard.
1. Send the copied URL to a Grafana user with authorization to view the link.
1. You also optionally click **Direct link rendered image** to share an image of the panel.

For more information, refer to the topic [Image rendering]({{< relref "../image-rendering/" >}}).

Here is an example of a link to a server-side rendered PNG:

```bash
https://play.grafana.org/d/000000012/grafana-play-home?orgId=1&from=1568719680173&to=1568726880174&panelId=4&fullscreen
```

#### Query string parameters for server-side rendered images

- **width:** width in pixels. Default is 800.
- **height:** height in pixels. Default is 400.
- **tz:** timezone in the format `UTC%2BHH%3AMM` where HH and MM are offset in hours and minutes after UTC
- **timeout:** number of seconds. The timeout can be increased if the query for the panel needs more than the default 30 seconds.
- **scale:** numeric value to configure device scale factor. Default is 1. Use a higher value to produce more detailed images (higher DPI). Supported in Grafana v7.0+.

## Publish snapshot

A panel snapshot shares an interactive panel publicly. Grafana strips sensitive data leaving only the visible metric data and series names embedded into your dashboard. Panel snapshots can be accessed by anyone with the link.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service provided by [Grafana Labs](https://grafana.com), that allows you to publish dashboard snapshots to an external Grafana instance. You can optionally set an expiration time if you want the snapshot to be removed after a certain time period.

![Panel share snapshot](/static/img/docs/sharing/share-panel-snapshot-8-0.png)

To publish a snapshot:

1. In the Share Panel dialog, click **Snapshot** to open the tab.
1. Click on **Local Snapshot** or **Publish to snapshots.raintank.io**. This generates the link of the snapshot.
1. Copy the snapshot link, and share it either within your organization or publicly on the web.

If you created a snapshot by mistake, click **delete snapshot** to remove the snapshot from your Grafana instance.

## Embed panel

You can embed a panel using an iframe on another web site. A viewer must be signed into Grafana to view the graph.

**> Note:** As of Grafana 8.0, anonymous access permission is no longer available for Grafana Cloud.

![Panel share embed](/static/img/docs/sharing/share-panel-embedded-link-8-0.png)

Here is an example of the HTML code:

```html
<iframe
  src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4"
  width="650"
  height="300"
  frameborder="0"
></iframe>
```

The result is an interactive Grafana graph embedded in an iframe:

<iframe src="https://snapshots.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4" width="650" height="300" frameborder="0"></iframe>

## Library panel

To create a library panel from the Share Panel dialog:

1. Click **Library panel**.
   {{< figure src="/static/img/docs/library-panels/create-lib-panel-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the create library panel dialog" >}}
1. In **Library panel name**, enter the name.
1. In **Save in folder**, select the folder to save the library panel. By default, the General folder is selected.
1. Click **Create library panel** to save your changes.
1. Save the dashboard.
