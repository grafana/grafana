----
page_title: Scripted dashboards
page_description: Scripted dashboards
page_keywords: grafana, scripted, guide, documentation
---

# Scripted Dashboards

If you have lots of metric names that change (new servers etc) in a defined pattern it is irritating to constantly have to create new dashboards.

With scripted dashboards you can dynamically create your dashboards using javascript. In the folder grafana install folder
under `public/dashboards/` there is a file named `scripted.js`. This file contains an example of a scripted dashboard. You can access it by using the url:
`http://grafana_url/dashboard/script/scripted.js?rows=3&name=myName`

If you open scripted.js you can see how it reads url parameters from ARGS variable and then adds rows and panels.

## Example

```javascript
var rows = 1;
var seriesName = 'argName';

if(!_.isUndefined(ARGS.rows)) {
  rows = parseInt(ARGS.rows, 10);
}

if(!_.isUndefined(ARGS.name)) {
  seriesName = ARGS.name;
}

for (var i = 0; i < rows; i++) {

  dashboard.rows.push({
    title: 'Scripted Graph ' + i,
    height: '300px',
    panels: [
      {
        title: 'Events',
        type: 'graph',
        span: 12,
        fill: 1,
        linewidth: 2,
        targets: [
          {
            'target': "randomWalk('" + seriesName + "')"
          },
          {
            'target': "randomWalk('random walk2')"
          }
        ],
      }
    ]
  });

}

return dashboard;
```

## More examples

You can find more examples in `public/dashboards/` directory of your grafana installation.
