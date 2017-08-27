+++
title = "Sharing"
keywords = ["grafana", "dashboard", "documentation", "sharing"]
type = "docs"
[menu.docs]
parent = "dashboard_features"
weight = 6
+++

# Sharing features

Grafana provides a number of ways to share a dashboard or a specific panel to other users within your
organization. It also provides ways to publish interactive snapshots that can be accessed by external partners.

## Share dashboard

Share a dashboard via the share icon in the top nav. This opens the share dialog where you
can get a link to the current dashboard with the current selected time range and template variables. If you have
made changes to the dashboard, make sure those are saved before sending the link.

### Dashboard snapshot

A dashboard snapshot is an instant way to share an interactive dashboard publicly. When created, we <strong>strip sensitive data</strong> like queries
(metric, template and annotation) and panel links, leaving only the visible metric data and series names embedded into your dashboard. Dashboard
snapshots can be accessed by anyone who has the link and can reach the URL.

![](/img/docs/v4/share_panel_modal.png)

### Publish snapshots

You can publish snapshots to you local instance or to [snapshot.raintank.io](http://snapshot.raintank.io). The later is a free service
that is provided by [Raintank](http://raintank.io) that allows you to publish dashboard snapshots to an external grafana instance.
The same rules still apply, anyone with the link can view it. You can set an expiration time if you want the snapshot to be removed
after a certain time period.

## Share Panel

Click a panel title to open the panel menu, then click share in the panel menu to open the Share Panel dialog. Here you have access to a link that will take you to exactly this panel with the current time range and selected template variables.

### Direct Link Rendered Image

You also get a link to service side rendered PNG of the panel. Useful if you want to share an image of the panel. Please note that for OSX and Windows, you will need to ensure that a `phantomjs` binary is available under `vendor/phantomjs/phantomjs`. For Linux, a `phantomjs` binary is included - however, you should ensure that any requisite libraries (e.g. libfontconfig) are available.

Example of a link to a server-side rendered PNG:

```
http://play.grafana.org/render/dashboard-solo/db/grafana-play-home?orgId=1&panelId=4&from=1499272191563&to=1499279391563&width=1000&height=500&tz=UTC%2B02%3A00&timeout=5000
```

#### Query String Parameters For Server-Side Rendered Images

- **width**: width in pixels. Default is 800.
- **height**: height in pixels. Default is 400.
- **tz**: timezone in the format `UTC%2BHH%3AMM` where HH and MM are offset in hours and minutes after UTC
- **timeout**: number of seconds. The timeout can be increased if the query for the panel needs more than the default 30 seconds.

### Embed Panel

You can embed a panel using an iframe on another web site. This tab will show you the html that you need to use.

Example:

```html
<iframe src="https://snapshot.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4" width="650" height="300" frameborder="0"></iframe>
```

Below there should be an interactive Grafana graph embedded in an iframe:

<iframe src="https://snapshot.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4" width="650" height="300" frameborder="0"></iframe>

### Export Panel Data

![](/img/docs/v4/export_panel_data.png)

The submenu for a panel can be found by clicking on the title of a panel and then on the hamburger (three horizontal lines) submenu on the left of the context menu.

This menu contains two options for exporting data:

- The panel JSON (the specification and not the data) can be exported or updated via the panel context menu.
- Panel data can be exported in the CSV format for Table and Graph Panels.
