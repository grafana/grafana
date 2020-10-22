+++
title = "Dashboard overview"
type = "docs"
aliases = ["/docs/grafana/latest/features/dashboard/dashboards/"]
[menu.docs]
identifier = "dashboards"
weight = 100
+++

# Dashboard overview

A _dashboard_ is a set of one or more panels organized and arranged into one or more rows. Grafana ships with a variety of Panels. Grafana makes it easy to construct the right queries, and customize the display properties so that you can create the perfect dashboard for your need. Each panel can interact with data from any configured Grafana Data Source (currently Graphite, Prometheus, Elasticsearch, InfluxDB, OpenTSDB, MySQL, PostgreSQL, Microsoft SQL Server and AWS Cloudwatch).

## Dashboard UI

<img src="/img/docs/v50/dashboard_annotated.png" class="no-shadow" width="700px">

1. Zoom out time range
1. Time picker dropdown. Here you can access relative time range options, auto refresh options and set custom absolute time ranges.
1. Manual refresh button. Will cause all panels to refresh (fetch new data).
1. Dashboard panel. Click the panel title to edit panels.
1. Graph legend. You can change series colors, y-axis and series visibility directly from the legend.

## Dashboard header

Click the new Dashboard link on the right side of the Dashboard picker. You now have a blank Dashboard.

<img class="no-shadow" src="/img/docs/v50/top_nav_annotated.png" width="580px">

The image above shows you the top header for a Dashboard.

1. Side menubar toggle: This toggles the side menu, allowing you to focus on the data presented in the dashboard. The side menu provides access to features unrelated to a Dashboard such as Users, Organizations, and Data Sources.
1. Dashboard dropdown: This dropdown shows you which Dashboard you are currently viewing, and allows you to easily switch to a new Dashboard. From here you can also create a new Dashboard or folder, import existing Dashboards, and manage Dashboard playlists.
1. Add Panel: Adds a new panel to the current Dashboard.
1. Star Dashboard: Star (or unstar) the current Dashboard. Starred Dashboards will show up on your own Home Dashboard by default, and are a convenient way to mark Dashboards that you're interested in.
1. Share Dashboard: Share the current dashboard by creating a link or create a static Snapshot of it. Make sure the Dashboard is saved before sharing.
1. Save dashboard: The current Dashboard will be saved with the current Dashboard name.
1. Settings: Manage Dashboard settings and features such as Templating and Annotations.

## Manage dashboards

The time period for the dashboard can be controlled by the [Time range controls]({{< relref "time-range-controls.md" >}}) in the upper right of the dashboard.

Dashboards can use [templating]({{< relref "../variables/_index.md" >}}) to make them more dynamic and interactive.

Dashboards can use [annotations]({{< relref "annotations.md" >}}) to display event data across panels. This can help correlate the time series data in the panel with other events.

Dashboards can be [shared]({{< relref "share-dashboard.md" >}}) easily in a variety of ways.

Dashboards can be tagged, and the dashboard picker provides quick, searchable access to all dashboards in a particular organization.

## Rows

A *row* is a logical divider within a dashboard. It is used to group panels together.

Rows are always 12 “units” wide. These units are automatically scaled dependent on the horizontal resolution of your browser. You can control the relative width of panels within a row by setting their specific width.

We use a unit abstraction so that Grafana looks great on all screen sizes.

 > **Note:** With MaxDataPoint functionality, Grafana can show you the perfect number of data points, regardless of resolution or time range.

Collapse a row by clicking on the row title. If you save a dashboard with a row collapsed, then it saves in that state and does not load those graphs until you expand the row.

Use the [repeating rows]({{< relref "../variables/_index.md#repeating-rows" >}}) functionality to dynamically create or remove entire rows, which can be filled with panels, based on the template variables selected.

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->