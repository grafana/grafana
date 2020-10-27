+++
title = "Manage users"
type = "docs"
[menu.docs]
name = "Manage users"
identifier = "manage-users"
weight = 40
+++

# Manage users

Create users and teams and configure [Permissions]({{< relref "../permissions/_index.md" >}}) to make sure that users only have access to the resources they need.

Only Administrators can manage users and teams.

## Users

Users are named accounts in Grafana that can be granted permissions to access resources throughout Grafana.

- [Add or remove a user]({{< relref "./add-or-remove-user.md" >}})
- [Enable or disable a user]({{< relref "./enable-or-disable-user.md" >}})

## Teams

Teams allow you to grant permissions for a group of users.

- [Create or remove a team]({{< relref "./create-or-remove-team.md" >}})
- [Add or remove a user from a team]({{< relref "./add-or-remove-user-from-team.md" >}})

## Learn more

Set up users and teams in our tutorial on how to [Create users and teams](https://grafana.com/tutorials/create-users-and-teams).

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->