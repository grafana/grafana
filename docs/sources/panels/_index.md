+++
title = "Panels"
type = "docs"
[menu.docs]
identifier = "panels"
weight = 4
+++

# Panel overview

The *panel* is the basic visualization building block in Grafana. Each panel has a query editor specific to the data source selected in the panel. The query editor allows you to extract the perfect visualization to display on the panel.

There are a wide variety of styling and formatting options for each panel. Panels can be dragged and dropped and rearranged on the dashboard. They can also be resized.

## Move panels

You can drag and drop panels by clicking and holding the panel title, then dragging it to its new location. You can also easily resize panels by clicking the (-) and (+) icons.

![](/static/img/docs/animated_gifs/drag_drop.gif)

## Tips and shortcuts

- Click the graph title and in the dropdown menu quickly duplicate the panel.
- Click the colored icon in the legend to change a series color or the y-axis.
- Click series name in the legend to hide series.
- Ctrl/Shift/Meta + click legend name to hide other series.
- Hover your cursor over a panel and press `e` to open the panel editor.
- Hover your cursor over a panel and press `v` to open the panel in fullscreen view.

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->