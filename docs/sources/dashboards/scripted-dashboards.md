+++
title = "Scripted dashboards"
keywords = ["grafana", "dashboard", "documentation", "scripted"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/scripting/"]
[menu.docs]
parent = "dashboard_features"
weight = 1500
+++

# Scripted dashboards

> **Warning:** This feature is deprecated and will be removed in a future release.

If you have lots of metric names that change (new servers etc) in a defined pattern it is irritating to constantly have to create new dashboards.

With scripted dashboards you can dynamically create your dashboards using javascript. In the Grafana install folder
under `public/dashboards/` there is a file named `scripted.js`. This file contains an example of a scripted dashboard. You can access it by using the URL:
`http://grafana_url/dashboard/script/scripted.js?rows=3&name=myName`

If you open scripted.js you can see how it reads URL parameters from ARGS variable and then adds rows and panels.

## Example

```javascript
var seriesName = 'argName';

if (!_.isUndefined(ARGS.name)) {
  seriesName = ARGS.name;
}

dashboard.panels.push({
  title: 'Events',
  type: 'graph',
  fill: 1,
  linewidth: 2,
  gridPos: {
    h: 10,
    w: 24,
    x: 0,
    y: 10,
  },
  targets: [
    {
      target: "randomWalk('" + seriesName + "')",
    },
    {
      target: "randomWalk('random walk2')",
    },
  ],
});

return dashboard;
```

## More examples

You can find more examples in `public/dashboards/` directory of your Grafana installation.
