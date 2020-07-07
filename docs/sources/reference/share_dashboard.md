+++
title = "Sharing a Dashboard"
keywords = ["grafana", "dashboard", "documentation", "sharing"]
type = "docs"
[menu.docs]
parent = "dashboard_features"
weight = 6
+++

# Share dashboard

Share a dashboard via the share icon in the top nav. This opens the share dialog where you
can get a link to the current dashboard with the current selected time range and template variables. If you have
made changes to the dashboard, make sure those are saved before sending the link. Below are ways to share a dashboard.

## Dashboard snapshot

A dashboard snapshot is an instant way to share an interactive dashboard publicly. When created, we <strong>strip sensitive data</strong> like queries
(metric, template and annotation) and panel links, leaving only the visible metric data and series names embedded into your dashboard. Dashboard
snapshots can be accessed by anyone who has the link and can reach the URL.

{{< docs-imagebox img="/img/docs/v50/share_panel_modal.png" max-width="700px" >}}

## Publish snapshots

You can publish snapshots to your local instance or to [snapshot.raintank.io](http://snapshot.raintank.io). The latter is a free service
provided by Grafana Labs, that allows you to publish dashboard snapshots to an external Grafana instance.
The same rules still apply, anyone with the link can view it. You can set an expiration time if you want the snapshot to be removed
after a certain time period.
