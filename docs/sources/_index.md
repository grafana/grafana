+++
title = "Grafana documentation"
description = "Guides, Installation and Feature Documentation"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
aliases = ["/docs/grafana/v1.1", "/docs/grafana/latest/guides/reference/admin", "/docs/grafana/v3.1"]
+++

# Grafana documentation

## Installing Grafana

<div class="nav-cards">
    <a href="{{< relref "installation/debian.md" >}}" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-linux">
        </div>
        <h5>Install on Linux</h5>
    </a>
    <a href="{{< relref "installation/mac.md" >}}" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-apple">
        </div>
        <h5>Install on macOS</h5>
    </a>
    <a href="{{< relref "installation/windows.md" >}}" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-windows">
        </div>
        <h5>Install on Windows</h5>
    </a>
    <a href="{{< relref "installation/docker.md" >}}" class="nav-cards__item nav-cards__item--install">
        <img src="/static/img/logos/logo-docker.svg">
        <h5>Run Docker image</h5>
    </a>
    <a href="https://grafana.com/docs/grafana-cloud/" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-cloud">
        </div>
        <h5>Grafana Cloud</h5>
    </a>
    <a href="https://grafana.com/grafana/download" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-moon-o">
        </div>
        <h5>Nightly builds</h5>
    </a>
</div>

## Guides

<div class="nav-cards">
    <a href="{{< relref "getting-started/what-is-grafana.md" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>What is Grafana?</h4>
        <p>Get an overview of Grafana's key features.</p>
    </a>
    <a href="{{< relref "getting-started/getting-started.md" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Getting started</h4>
        <p>Learn the basics of using Grafana.</p>
    </a>
    <a href="{{< relref "administration/configuration.md" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Configure Grafana</h4>
        <p>Review the configuration and setup options.</p>
    </a>
    <a href="{{< relref "getting-started/timeseries.md" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Intro to time series</h4>
        <p>Learn about time series data.</p>
    </a>
    <a href="{{< relref "administration/provisioning.md" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Provisioning</h4>
        <p>Learn how to automate your Grafana configuration.</p>
    </a>
    <a href="{{< relref "whatsnew/whats-new-in-v7-3.md" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>What's new in v7.3</h4>
        <p>Explore the features and enhancements in the latest release.</p>
    </a>

</div>

## Data source guides

<div class="nav-cards">
    <a href="{{< relref "datasources/graphite.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_graphite.svg" >
      <h5>Graphite</h5>
    </a>
    <a href="{{< relref "datasources/elasticsearch.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_elasticsearch.svg" >
      <h5>Elasticsearch</h5>
    </a>
    <a href="{{< relref "datasources/influxdb.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_influxdb.svg" >
      <h5>InfluxDB</h5>
    </a>
    <a href="{{< relref "datasources/prometheus.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_prometheus.svg" >
      <h5>Prometheus</h5>
    </a>
    <a href="{{< relref "datasources/cloudmonitoring.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_cloudmonitoring.svg">
      <h5>Google Cloud Monitoring</h5>
    </a>
    <a href="{{< relref "datasources/cloudwatch.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_cloudwatch.svg">
      <h5>AWS CloudWatch</h5>
    </a>
    <a href="{{< relref "datasources/azuremonitor.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_azure_monitor.jpg">
      <h5>Azure Monitor</h5>
    </a>
    <a href="{{< relref "datasources/loki.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_loki.svg">
      <h5>Loki</h5>
    </a>
    <a href="{{< relref "datasources/mysql.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_mysql.png" >
      <h5>MySQL</h5>
    </a>
    <a href="{{< relref "datasources/postgres.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_postgres.svg" >
      <h5>Postgres</h5>
    </a>
    <a href="{{< relref "datasources/mssql.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/sql_server_logo.svg">
      <h5>Microsoft SQL Server</h5>
    </a>
    <a href="{{< relref "datasources/opentsdb.md" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/img/docs/logos/icon_opentsdb.png" >
      <h5>OpenTSDB</h5>
    </a>
</div>

<!-- BEGIN Optimal Workshop Intercept Snippet --><div id='owInviteSnippet' style='position:fixed;right:20px;bottom:20px;width:280px;padding:20px;margin:0;border-radius:6px;background:#1857B8;color:#F7F8FA;text-align:left;z-index:2200000000;opacity:0;transition:opacity 500ms;-webkit-transition:opacity 500ms;display:none;'><div id='owInviteMessage' style='padding:0;margin:0 0 20px 0;font-size:16px;'>Got a spare two and a half minutes to help us improve the docs?</div><a id='owInviteOk' href='https://Grafana.optimalworkshop.com/questions/grafana-docs?tag=docs&utm_medium=intercept' onclick='this.parentNode.style.display="none";' target='_blank' style='color:#F7FAFF;font-size:16px;font-weight:bold;text-decoration:underline;'>Yes, I&#x27;ll help</a><a id='owInviteCancel' href='javascript:void(0)' onclick='this.parentNode.style.display="none";' style='color:#F7F8FA;font-size:14px;text-decoration:underline;float:right;'>Close</a></div><script>var owOnload=function(){if(-1==document.cookie.indexOf('ow-intercept-quiz-4ior230e')){var o=new XMLHttpRequest;o.onloadend=function(){try{var o=document.getElementById('owInviteSnippet');var date=new Date();date.setMonth(date.getMonth()+1);this.response&&JSON.parse(this.response).active===!0&&(document.cookie='ow-intercept-quiz-4ior230e=Done;path=/;expires='+date.toUTCString()+';',setTimeout(function(){o.style.display='block',o.style.opacity=1},2e3))}catch(e){}},o.open('POST','https://app.optimalworkshop.com/survey_status/questions/4ior230e/active'),o.send()}};if(window.addEventListener){window.addEventListener('load',function(){owOnload();});}else if(window.attachEvent){window.attachEvent('onload',function(){owOnload();});}</script><!-- END Optimal Workshop snippet -->