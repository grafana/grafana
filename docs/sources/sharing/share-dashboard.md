---
aliases:
  - ../dashboards/share-dashboard/
  - ../reference/share_dashboard/
keywords:
  - grafana
  - dashboard
  - documentation
  - sharing
title: Share a dashboard
weight: 6
---

# Share a dashboard

You can share a dashboard as a direct link or as a snapshot. You can also export a dashboard. If you have made changes to the dashboard, verify those changes are saved before sharing.

To share a dashboard:

1. Go to the home page of your Grafana instance.
1. Click on the share icon in the top navigation. The share dialog opens and shows the Link tab.

![Dashboard share direct link](/static/img/docs/sharing/share-dashboard-direct-link-7-3.png)

## Use direct link

The Link tab has the current time range, template variables and theme selected by default. You can optionally select a shortened URL to share.

To share a direct link:

1. Click **Copy**. This copies the default or the shortened URL to the clipboard.
1. Send the copied URL to a Grafana user with authorization to view the link.

## Publish a snapshot

A dashboard snapshot shares an interactive dashboard publicly. Grafana strips sensitive data like queries
(metric, template and annotation) and panel links, leaving only the visible metric data and series names embedded into your dashboard. Dashboard snapshots can be accessed by anyone with the link.

You can publish snapshots to your local instance or to [snapshots.raintank.io](http://snapshots.raintank.io). The latter is a free service
provided by Grafana Labs that allows you to publish dashboard snapshots to an external Grafana instance. The same rules still apply: anyone with the link can view it. You can set an expiration time if you want the snapshot removed after a certain time period.

![Dashboard share snapshot](/static/img/docs/sharing/share-dashboard-snapshot-7-3.png)

To publish a snapshot:

1. Click on **Local Snapshot** or **Publish to snapshots.raintank.io**. This generates the link of the snapshot.
1. Copy the snapshot link, and share it either within your organization or publicly on the web.

In case you created a snapshot by mistake, click **delete snapshot** to remove the snapshot from your Grafana instance.

## Dashboard export

Grafana dashboards can easily be exported and imported. For more information, refer to [Export and import dashboards]({{< relref "../dashboards/export-import.md" >}}).

![Export](/static/img/docs/sharing/share-dashboard-export-7-3.png)
