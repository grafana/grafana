+++
title = "HTTP API"
description = "Grafana HTTP API"
keywords = ["grafana", "http", "documentation", "api", "overview"]
aliases = ["/docs/grafana/latest/overview"]
type = "docs"
[menu.docs]
name = "HTTP API"
identifier = "http_api"
weight = 9
+++


# HTTP API Reference

The Grafana backend exposes an HTTP API, the same API is used by the frontend to do everything from saving
dashboards, creating users and updating data sources.

## Supported HTTP APIs


- [Authentication API]({{< relref "auth.md" >}})
- [Dashboard API]({{< relref "dashboard.md" >}})
- [Dashboard Versions API]({{< relref "dashboard_versions.md" >}})
- [Dashboard Permissions API]({{< relref "dashboard_permissions.md" >}})
- [Folder API]({{< relref "folder.md" >}})
- [Folder Permissions API]({{< relref "folder_permissions.md" >}})
- [Folder/dashboard search API]({{< relref "folder_dashboard_search.md" >}})
- [Data Source API]({{< relref "data_source.md" >}})
- [Organization API]({{< relref "org.md" >}})
- [Snapshot API]({{< relref "snapshot.md" >}})
- [Annotations API]({{< relref "annotations.md" >}})
- [Playlists API]({{< relref "playlist.md" >}})
- [Alerting API]({{< relref "alerting.md" >}})
- [Alert Notification Channels API]({{< relref "alerting_notification_channels.md" >}})
- [User API]({{< relref "user.md" >}})
- [Team API]({{< relref "team.md" >}})
- [Admin API]({{< relref "admin.md" >}})
- [Preferences API]({{< relref "preferences.md" >}})
- [Other API]({{< relref "other.md" >}})

### Grafana Enterprise HTTP APIs

- [Data Source Permissions API]({{< relref "datasource_permissions.md" >}})
- [External Group Sync API]({{< relref "external_group_sync.md" >}})
- [Reporting API]({{< relref "reporting.md" >}})

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->