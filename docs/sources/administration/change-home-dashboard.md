+++
title = "Change the default home dashboard"
description = "How to replace the default home dashboard"
keywords = ["grafana", "configuration", "documentation", "home"]
type = "docs"
[menu.docs]
name = "Home Dashboard"
identifier = "change-home-dashboard"
parent = "admin"
weight = 100
+++

# Change the default home dashboard

You can change the default dashboard on the organization, team and user level. The home dashboard you set for the whole organization is the one all users will see by default. The team dashboard applies to all users assigned to the team in Grafana. The team dashboard overrides the organization dashboard settings. Personal dashboard settings override team dashboard settings. 

## Set the home dashboard for your organization

### Set the default dashboard through preferences

1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title.
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards.

### Set the default dashboard through configuration

If preferences are set as described above, then they override this value.
You can provide your own JSON file to change the home dashboard. No user will be able to update this dashboard in Grafana.

#### [Optional] Convert an existing dashboard into a JSON file
1. Navigate to your dashboard page.
1. Click the **Share dashboard** icon next to the dashboard title.
1. In the **Export** tab, click on **Save to file**.

#### Use a JSON file as the home dashboard
1. Save your JSON file somewhere that Grafana can access it, for example, in the Grafana `data` folder of Grafana. 
1. Update your configuration file to set the path to the JSON file. Read how to update this file in the [configuration]({{< relref "./configuration.md">}}) documentation.
```ini
[dashboards]
# Path to the default home dashboard. If this value is empty, then Grafana uses StaticRootPath + "dashboards/home.json"
default_home_dashboard_path = data/main-dashboard.json
```

## Set home dashboard for your team

1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title. 
1. On the left menu, hover your cursor over the **Configuration** (gear) icon and then click **Teams**.
1. Click on the team you want to change the home dashboard for and then navigate to the **Settings** tab.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards. 

## Set your personal home dashboard

1. Navigate to the dashboard you want to set as the home dashboard.
1. Star this dashboard by clicking on the star next to the dashboard title. 
1. On the left menu, hover your cursor over your avatar and then click **Preferences**.
1. In the **Home Dashboard** field, select the dashboard you want to use for your home dashboard. Options include all starred dashboards. 

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->