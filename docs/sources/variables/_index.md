+++
title = "Templates and variables"
type = "docs"
[menu.docs]
identifier = "variables"
weight = 130
+++

# Templates and variables

A variable is a placeholder for a value. You can use variables in metric queries and in panel titles. So when you change
the value, using the dropdown at the top of the dashboard, your panel's metric queries will change to reflect the new value.

Variables allow you to create more interactive and dynamic dashboards. Instead of hard-coding things like server, application,
and sensor names in your metric queries, you can use variables in their place. Variables are displayed as dropdown lists at the top of
the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.
{{< docs-imagebox img="/img/docs/v50/variables_dashboard.png" >}}

These can be especially useful for administrators who want to allow Grafana viewers to quickly adjust visualizations but do not want to give them full editing permissions. Grafana Viewers can use variables.

Variables and templates also allow you to single-source dashboards. If you have multiple identical data sources or servers, you can make one dashboard and use variables to change what you are viewing. This simplifies maintenance and upkeep enormously.

## Templates

A _template_ is any query that contains a variable.

For example, if you were administering a dashboard to monitor several servers, you _could_ make a dashboard for each server. Or you could create one dashboard and use panels with template queries like this one:

```
wmi_system_threads{instance=~"$server"}
```

Variable values are always synced to the URL using the syntax `var-<varname>=value`.

## Examples of templates and variables

To see variable and template examples, go to any of the dashboards listed in [Variable examples]({{< relref "variable-examples.md" >}}).

Variables are listed in drop-down lists across the top of the screen. Select different variables to see how the visualizations change. 

To see variable settings, navigate to **Dashboard Settings > Variables**. Click a variable in the list to see its settings.

Variables can be used in titles, descriptions, text panels, and queries. Queries with text that starts with `$` are templates. Not all panels will have template queries.

## Variable best practices

- Variable drop-down lists are displayed in the order they are listed in the variable list in Dashboard settings.
- Put the variables that you will change often at the top, so they will be shown first (far left on the dashboard).

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->