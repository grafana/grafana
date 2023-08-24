+++
title = "Change your password"
description = "How to change your Grafana password"
keywords = ["grafana", "password", "change", "preferences"]
type = "docs"
[menu.docs]
identifier = "change-your-password"
parent = "administration"
weight = 100
+++

# Change your Grafana password

You can change your password in the Change Password tab.

> **Note:** If your Grafana instance uses an external authentication provider, then you might not be able to change your password. Contact your Grafana administrator for more information.

## Change your password

1. Hover your mouse over your user icon in the lower left corner of the screen.
1. Click **Change Password**. Grafana opens the Change Password tab.
1. Enter your **Old password** to authorize the change.
1. Enter your **New password** and then **Confirm password**.
1. Click **Change Password**.

## Admin user management resources

Grafana admins can use the following tools:

- Use the [User API]({{< relref "../http_api/user.md" >}}) to change your password programmatically or to manage users.
- The [Manage users]({{< relref "../manage-users/_index.md" >}}) section explains how to manage users and teams.

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->