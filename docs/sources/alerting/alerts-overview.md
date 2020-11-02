+++
title = "Alerts overview"
type = "docs"
[menu.docs]
identifier = "alerting"
parent = "Alerting"
aliases = ["/docs/grafana/latest/alerting/rules/", "/docs/grafana/latest/alerting/metrics/", "/docs/grafana/latest/alerting/rules/#query-condition-example", "/docs/grafana/latest/alerting/rules/#for", "/docs/grafana/latest/alerting/rules/#rule-config"]
weight = 100
+++

# Alerts overview

Alerts allow you to identify problems in your system moments after they occur. By quickly identifying unintended changes in your system, you can minimize disruptions to your services.

Alerts consists of two parts:

- Alert rules - When the alert is triggered. Alert rules are defined by one or more conditions that are regularly evaluated by Grafana.
- Notification channel - How the alert is delivered. When the conditions of an alert rule are met, the Grafana notifies the channels configured for that alert.

Currently only the graph panel visualization supports alerts.

## Alert tasks

You can perform the following tasks for alerts:

- [Add or edit an alert notification channel]({{< relref "notifications.md" >}})
- [Create an alert rule]({{< relref "create-alerts.md" >}})
- [View existing alert rules and their current state]({{< relref "view-alerts.md" >}})
- [Test alert rules and troubleshoot]({{< relref "troubleshoot-alerts.md" >}})

## Clustering

Currently alerting supports a limited form of high availability. Since v4.2.0 of Grafana, alert notifications are deduped when running multiple servers. This means all alerts are executed on every server but no duplicate alert notifications are sent due to the deduping logic. Proper load balancing of alerts will be introduced in the future.

## Notifications

You can also set alert rule notifications along with a detailed message about the alert rule. The message can contain anything: information about how you might solve the issue, link to runbook, and so on.

The actual notifications are configured and shared between multiple alerts.

## Alert execution

Alert rules are evaluated in the Grafana backend in a scheduler and query execution engine that is part
of core Grafana. Only some data sources are supported right now. They include `Graphite`, `Prometheus`, `InfluxDB`, `Elasticsearch`,
`Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, and `Azure Data Explorer`.

## Metrics from the alert engine

The alert engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics]({{< relref "../administration/metrics/" >}}).

Description | Type | Metric name
---------- | ----------- | ----------
Total number of alerts | counter | `alerting.active_alerts`
Alert execution result | counter | `alerting.result`
Notifications sent counter | counter | `alerting.notifications_sent`
Alert execution timer | timer | `alerting.execution_time`

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->