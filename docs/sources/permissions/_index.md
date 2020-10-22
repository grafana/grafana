+++
title = "Permissions"
description = "Permissions"
keywords = ["grafana", "configuration", "documentation", "admin", "users", "datasources", "permissions"]
type = "docs"
aliases = ["/docs/grafana/latest/permissions/overview/"]
[menu.docs]
name = "Permissions"
identifier = "permissions"
weight = 50
+++

# Permissions

What you can do in Grafana is defined by the _permissions_ associated with your user account.

There are three types of permissions:
- Permissions granted as a Grafana server admin
- Permissions associated with your role in an organization
- Permissions granted to a specific folder or dashboard

You can be granted permissions based on:
- Grafana server admin status.
- Organization role (Admin, Editor, or Viewer).
- Folder or dashboard permissions assigned to your team (Admin, Editor, or Viewer).
- Folder or dashboard permissions assigned to your user account (Admin, Editor, or Viewer).
- (Grafana Enterprise) Data source permissions. For more information, refer to [Data source permissions]({{< relref "../enterprise/datasource_permissions.md" >}}) in [Grafana Enterprise]({{< relref "../enterprise" >}}).

## Grafana server admin

Grafana server admins have the **Grafana Admin** flag enabled on their account. They can access the **Server Admin** menu and perform the following tasks:

- Manage users and permissions.
- Create, edit, and delete organizations.
- View server-wide settings that are set in the [Configuration]({{< relref "../administration/configuration.md" >}}) file.
- View Grafana server stats, including total users and active sessions.
- Upgrade the server to Grafana Enterprise.

## Organization roles

Users can belong to one or more organizations. A user's organization membership is tied to a role that defines what the user is allowed to do in that organization. For more information, refer to [Organization roles]({{< relref "../permissions/organization_roles.md" >}}).

## Dashboard and folder permissions

Dashboard and folder permissions allow you to remove the default role based permissions for Editors and Viewers and assign permissions to specific users and teams. Learn more about [Dashboard and folder permissions]({{< relref "dashboard_folder_permissions.md" >}}).

## Data source permissions

Per default, a data source in an organization can be queried by any user in that organization. For example a user with `Viewer` role can still
issue any possible query to a data source, not just those queries that exist on dashboards he/she has access to.

Data source permissions allows you to change the default permissions for data sources and restrict query permissions to specific **Users** and **Teams**. For more information, refer to [Data source permissions]({{< relref "../enterprise/datasource_permissions.md" >}}) in [Grafana Enterprise]({{< relref "../enterprise" >}}).

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->