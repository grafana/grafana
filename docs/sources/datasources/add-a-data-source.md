+++
title = "Add data source"
type = "docs"
aliases = ["/docs/grafana/v7.2/features/datasources/add-a-data-source/"]
[menu.docs]
name = "Add a data source"
identifier = "add_data_source"
parent = "features"
weight = 100
+++

# Add a data source

Before you create your first dashboard, you need to add your data source. Following are the list of instructions to create one.

> **Note:** Only users with the organization Admin role can add data sources.

1. Move your cursor to the cog on the side menu which will show you the configuration menu. If the side menu is not visible click the Grafana icon in the upper left corner. Click on **Configuration** > **Data Sources** in the side menu and you'll be taken to the data sources page
   where you can add and edit data sources. You can also click the cog.
{{< figure src="/static/img/docs/v52/sidemenu-datasource.png" max-width="250px" class="docs-image--no-shadow">}}

1. Click **Add data source** and you will come to the settings page of your new data source.

    {{< figure src="/static/img/docs/v52/add-datasource.png" max-width="700px" class="docs-image--no-shadow">}}

1. In the **Name** box, enter a name for this data source.

    {{< figure src="/static/img/docs/v52/datasource-settings.png" max-width="700px" class="docs-image--no-shadow">}}

1. In the **Type**, select the type of data source. See [Supported data sources]({{< relref "_index.md#supported-data-sources" >}}) for more information and how to configure your data source settings.

1. Click **Save & Test**.

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->
