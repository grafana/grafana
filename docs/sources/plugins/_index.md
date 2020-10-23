+++
title = "Plugins"
type = "docs"
[menu.docs]
name = "Plugins"
identifier = "plugins"
weight = 1
+++

# Plugins

Besides the wide range of visualizations and data sources that are available immediately after you install Grafana, you can extend your Grafana experience with _plugins_.

You can [install]({{< relref "installation.md" >}}) one of the plugins built by the Grafana community, or [build one yourself]({{< relref "../developers/plugins/_index.md" >}}).

Grafana supports three types of plugins: [panels](https://grafana.com/grafana/plugins?type=panel), [data sources](https://grafana.com/grafana/plugins?type=datasource), and [apps](https://grafana.com/grafana/plugins?type=app).

## Panel plugins

Add new visualizations to your dashboard with panel plugins, such as the [Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel), [Clock](https://grafana.com/grafana/plugins/grafana-clock-panel), and [Pie Chart](https://grafana.com/grafana/plugins/grafana-piechart-panel).

Use panel plugins when you want to:

- Visualize data returned by data source queries.
- Navigate between dashboards.
- Control external systems, such as smart home devices.

## Data source plugins

Data source plugins add support for new databases, such as [Google BigQuery](https://grafana.com/grafana/plugins/doitintl-bigquery-datasource).

Data source plugins communicate with external sources of data and return the data in a format that Grafana understands. By adding a data source plugin, you can immediately use the data in any of your existing dashboards.

Use data source plugins when you want to import data from external systems.

## App plugins

Applications, or _app plugins_, bundle data sources and panels to provide a cohesive experience, such as the [Zabbix](https://grafana.com/grafana/plugins/alexanderzobnin-zabbix-app) and [Kubernetes](https://grafana.com/grafana/plugins/grafana-kubernetes-app) apps.

Apps can also add custom pages for things like control panels.

Use app plugins when you want to create an custom out-of-the-box monitoring experience.

## Learn more

- [Install plugins]({{< relref "./installation.md" >}})
- [Plugin signature verification]({{< relref "./plugin-signature-verification.md" >}})
- Browse the available [Plugins](https://grafana.com/grafana/plugins)

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->