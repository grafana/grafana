+++
title = "With Grafana"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
weight = 200
+++

# Getting started with Grafana

This topic helps you get started with Grafana and build your first dashboard. To learn more about Grafana, refer to [What is Grafana?]({{< relref "_index.md" >}}).

## Step 1: Install Grafana

Grafana can be installed on many different operating systems. For a list of minimum hardware and software requirements, as well as instructions on installing Grafana, refer to [Install Grafana]({{< relref "../installation/_index.md" >}}).

## Step 2: Log in

To log in to Grafana for the first time:

1. Open your web browser and go to http://localhost:3000/. The default HTTP port that Grafana listens to is `3000` unless you have configured a different port.
1. On the login page, enter `admin` for username and password.
1. Click **Log In**. If login is successful, then you will see a prompt to change the password.
1. Click **OK** on the prompt, then change your password.

> **Note:** We strongly recommend that you follow Grafana's best practices and change the default administrator password. Don't forget to record your credentials!

## Step 3: Create a dashboard

To create your first dashboard:

1. Click the **+** icon on the left panel, select **Create Dashboard**, and then click **Add new panel**.
1. In the New Dashboard/Edit Panel view, go to the **Query** tab.
1. Configure your [query]({{< relref "../panels/queries.md" >}}) by selecting ``-- Grafana --`` from the [data source selector]({{< relref "../panels/queries.md/#data-source-selector" >}}). This generates the Random Walk dashboard.
1. Click the  **Save** icon in the top right corner of your screen to save the dashboard.
1. Add a descriptive name, and then click **Save**.

 Congratulations, you have created your first dashboard and it is displaying results.

## Next steps

 Continue to experiment with what you have built, try the [explore workflow]({{< relref "../explore/index.md" >}}) or another visualization feature. Refer to [Data sources]({{< relref "../datasources" >}}) for a list of supported data sources and instructions on how to [add a data source]({{< relref "../datasources/add-a-data-source.md" >}}). The following topics will be of interest to you:

- [Panels]({{< relref "../panels/_index.md" >}})
- [Dashboards]({{< relref "../dashboards/_index.md" >}})
- [Keyboard shortcuts]({{< relref "../dashboards/shortcuts.md" >}})
- [Plugins](https://grafana.com/grafana/plugins?orderBy=weight&direction=asc)

### Admins

The following topics are of interest to Grafana server admin users:

- [Grafana configuration]({{< relref "../administration/configuration.md" >}})
- [Authentication]({{< relref "../auth/overview.md" >}})
- [User permissions and roles]({{< relref "../permissions/_index.md" >}})
- [Provisioning]({{< relref "../administration/provisioning.md" >}})
- [Grafana CLI]({{< relref "../administration/cli.md" >}})

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->
