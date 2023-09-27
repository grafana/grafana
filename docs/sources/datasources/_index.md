+++
title = "Data sources"
type = "docs"
aliases = ["/docs/grafana/v7.2/datasources/overview/"]
[menu.docs]
name = "Data sources"
identifier = "datasources"
parent = "features"
weight = 50
+++

# Data sources

Grafana supports many different storage backends for your time series data (data source). Each data source has a specific Query Editor that is customized for the features and capabilities that the particular data source exposes.

## Querying

The query language and capabilities of each data source are obviously very different. You can combine data from multiple data sources onto a single Dashboard, but each Panel is tied to a specific data source that belongs to a particular Organization.

## Supported data sources

The following data sources are officially supported:

- [AWS CloudWatch]({{< relref "cloudwatch.md" >}})
- [Azure Monitor]({{< relref "azuremonitor.md" >}})
- [Elasticsearch]({{< relref "elasticsearch.md" >}})
- [Google Cloud Monitoring]({{< relref "cloudmonitoring.md" >}})
- [Graphite]({{< relref "graphite.md" >}})
- [InfluxDB]({{< relref "influxdb.md" >}})
- [Loki]({{< relref "loki.md" >}})
- [Microsoft SQL Server (MSSQL)]({{< relref "mssql.md" >}})
- [MySQL]({{< relref "mysql.md" >}})
- [OpenTSDB]({{< relref "opentsdb.md" >}})
- [PostgreSQL]({{< relref "postgres.md" >}})
- [Prometheus]({{< relref "prometheus.md" >}})
- [Jaeger]({{< relref "jaeger.md" >}})
- [Zipkin]({{< relref "zipkin.md" >}})
- [Tempo]({{< relref "tempo.md" >}})
- [Testdata]({{< relref "testdata.md" >}})

In addition to the data sources that you have configured in your Grafana, there are three special data sources available:

- **Grafana -** A built-in data source that generates random walk data. Useful for testing visualizations and running experiments.
- **Mixed -** Select this to query multiple data sources in the same panel. When this data source is selected, Grafana allows you to select a data source for every new query that you add.
  - The first query will use the data source that was selected before you selected **Mixed**.
  - You cannot change an existing query to use the Mixed Data Source.
  - Grafana Play example: [Mixed data sources](https://play.grafana.org/d/000000100/mixed-datasources?orgId=1)
- **Dashboard -** Select this to use a result set from another panel in the same dashboard.

## Data source plugins

Since Grafana 3.0 you can install data sources as plugins. Check out [Grafana.com/plugins](https://grafana.com/plugins) for more data sources.

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->
