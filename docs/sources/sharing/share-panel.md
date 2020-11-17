+++
title = "Share a Panel"
keywords = ["grafana", "dashboard", "documentation", "sharing"]
weight = 6
draft = "true"
+++

# Share a panel

To share a panel

1. Click a panel title to open the panel menu.
1. Click share in the panel menu to open the Share Panel dialog.

 Here you have access to a link that will take you to exactly this panel with the current time range and selected template variables. Here are some of the ways you can share a panel.

## Publish snapshots

You can publish snapshots to your local instance or to [snapshot.raintank.io](http://snapshot.raintank.io). The latter is a free service provided by [Raintank](http://raintank.io), that allows you to publish dashboard snapshots to an external Grafana instance.

Anyone with the link can view it. You can optionally set an expiration time if you want the snapshot to be removed after a certain time period.

{{< docs-imagebox img="/img/docs/panels/Share_a_panel.png" max-width="700px" >}}

## Direct Link Rendered Image

You also get a link to render a PNG image of the panel. Useful if you want to share an image of the panel. For more information about the requirements and how to configure image rendering, refer to [image rendering](/administration/image_rendering/).

Example of a link to a server-side rendered PNG:

```bash
https://play.grafana.org/d/000000012/grafana-play-home?orgId=1&from=1568719680173&to=1568726880174&panelId=4&fullscreen
```

#### Query String Parameters For Server-Side Rendered Images

- **width**: width in pixels. Default is 800.
- **height**: height in pixels. Default is 400.
- **tz**: timezone in the format `UTC%2BHH%3AMM` where HH and MM are offset in hours and minutes after UTC
- **timeout**: number of seconds. The timeout can be increased if the query for the panel needs more than the default 30 seconds.

## Embed Panel

You can embed a panel using an iframe on another web site. This tab will show you the html that you need to use.

> **Note:** This sharing requires [allow_embedding]({{< relref "../administration/configuration.md#allow-embedding" >}}) enabled and anonymous access, or proper configuration of the [cookie_samesite]({{< relref "../administration/configuration.md#cookie-samesite" >}}) setting.

Example:

```html
<iframe src="https://snapshot.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4" width="650" height="300" frameborder="0"></iframe>
```

Below there should be an interactive Grafana graph embedded in an iframe:

<iframe src="https://snapshot.raintank.io/dashboard-solo/snapshot/y7zwi2bZ7FcoTlB93WN7yWO4aMiz3pZb?from=1493369923321&to=1493377123321&panelId=4" width="650" height="300" frameborder="0"></iframe>

#### Export Panel Data

{{< docs-imagebox img="/img/docs/v50/export_panel_data.png" max-width="500px" >}}

The submenu for a panel can be found by clicking on the title of a panel and then on the More submenu.

This menu contains two options for exporting data:

- The panel JSON (the specification and not the data) can be exported or updated via the panel context menu.
- Panel data can be exported in the CSV format for Table and Graph Panels.
