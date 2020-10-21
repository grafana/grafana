+++
title = "Getting started"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
[menu.docs]
name = "Getting started"
identifier = "getting_started_guide"
parent = "guides"
weight = 200
+++

# Getting started

This guide will help you get started and acquainted with Grafana. To learn more about Grafana in general, refer to [What is Grafana?]({{< relref "what-is-grafana.md" >}}).

## Install Grafana

This step varies according to your computer operating system. Refer to the instructions for your OS in the [Installation]({{< relref "../installation/_index.md" >}}) section for instructions.

## Log in for the first time 

1. Open your web browser and go to http://localhost:3000/. `3000` is the default HTTP port that Grafana listens to if you haven’t configured a different port.
1. On the login page, type `admin` for the username and password.
1. Change your password. 

> **Note:** We strongly encourage you to follow Grafana best practices and change the default administrator password. Don't forget to record your credentials!

## Create a dashboard

1. Click **New dashboard**.
1. Click **Add Query**. Grafana creates a basic graph panel with the Random Walk scenario.
1. Save your dashboard. Click the **Save dashboard** icon in the top corner of the screen.

 Congratulations, you have gotten started with Grafana! You have a dashboard and are displaying results. Feel free to experiment with what you have built, continue on to add another data source, or explore [Next steps](#next-steps).

## Next steps

Different user types will have different interests. Some suggestions are listed below, or refer to [What is Grafana?]({{< relref "what-is-grafana.md" >}}) for a general overview of Grafana features.

### All users

All users might want to learn about:

* [Panels]({{< relref "../panels/panels-overview.md" >}})
* [Dashboards]({{< relref "../dashboards/_index.md" >}})
* [Data sources]({{< relref "../datasources/_index.md" >}}) and [Add a data source]({{< relref "../datasources/add-a-data-source.md" >}})
* [Keyboard shortcuts]({{< relref "../dashboards/shortcuts.md" >}})
* [Explore workflow]({{< relref "../explore/index.md" >}})
* [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

### Admins

Administrators might want to learn about:

- [Grafana configuration]({{< relref "../administration/configuration.md" >}})
- [Authentication]({{< relref "../auth/overview.md" >}})
- [User permissions and roles]({{< relref "../permissions/_index.md" >}})
- [Provisioning]({{< relref "../administration/provisioning.md" >}})
- [Grafana CLI]({{< relref "../administration/cli.md" >}})

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->