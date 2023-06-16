---
aliases:
  - /docs/grafana/v1.1/
  - /docs/grafana/v3.1/
  - guides/reference/admin/
cascade:
  # Until a better mechanism for arrangement is thought of, the following sequence should be ordered alphabetically by the `_target.path` value.
  - _target: { path: /docs/grafana/** } # Default to every page having "Enterprise" and "Open source" labels.
    labels:
      products:
        - enterprise
        - oss

  - _target: { path: /docs/grafana/** }
    labels:
      products:
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/administration/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/administration/enterprise-licensing/** }
    labels:
      products:
        - enterprise

  - _target: { path: /docs/grafana/*/administration/organization-management/** }
    labels:
      products:
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/administration/provisioning/** }
    labels:
      products:
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/administration/recorded-queries/** }
    labels:
      products:
        - cloud
        - enterprise

  - _target: { path: /docs/grafana/*/administration/roles-and-permissions/access-control/** }
    labels:
      products:
        - cloud
        - enterprise

  - _target: { path: /docs/grafana/*/administration/stats-and-license/** }
    labels:
      products:
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/alerting/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/breaking-changes/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/dashboards/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/datasources/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/explore/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/fundamentals/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/introduction/grafana-cloud/** }
    labels:
      products:
        - cloud

  - _target: { path: /docs/grafana/*/introduction/grafana-enterprise/** }
    labels:
      products:
        - enterprise

  - _target: { path: /docs/grafana/*/panels-visualizations/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/release-notes/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/search/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/audit-grafana/** }
    labels:
      products:
        - cloud
        - enterprise

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/configure-authentication/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/configure-authentication/enhanced-ldap/** }
    labels:
      products:
        - cloud
        - enterprise

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/configure-authentication/saml/** }
    labels:
      products:
        - cloud
        - enterprise

  - _target:
      path: /docs/grafana/*/setup-grafana/configure-security/configure-database-encryption/encrypt-secrets-using-hashicorp-key-vault/**
    labels:
      products:
        - cloud
        - enterprise

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/configure-request-security/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/configure-team-sync/** }
    labels:
      products:
        - cloud
        - enterprise

  - _target: { path: /docs/grafana/*/setup-grafana/configure-security/export-logs/** }
    labels:
      products:
        - cloud
        - oss

  - _target: { path: /docs/grafana/*/troubleshooting/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss

  - _target: { path: /docs/grafana/*/whatsnew/** }
    labels:
      products:
        - cloud
        - enterprise
        - oss
description: Guides, installation, and feature documentation
keywords:
  - grafana
  - installation
  - documentation
title: Grafana documentation
---

# Grafana documentation

## Installing Grafana

<div class="nav-cards">
    <a href="{{< relref "setup-grafana/installation/debian/" >}}" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-linux">
        </div>
        <h5>Install on Linux</h5>
    </a>
    <a href="{{< relref "setup-grafana/installation/mac/" >}}" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-apple">
        </div>
        <h5>Install on macOS</h5>
    </a>
    <a href="{{< relref "setup-grafana/installation/windows/" >}}" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-windows">
        </div>
        <h5>Install on Windows</h5>
    </a>
    <a href="{{< relref "setup-grafana/installation/docker/" >}}" class="nav-cards__item nav-cards__item--install">
        <img src="/static/img/logos/logo-docker.svg">
        <h5>Run Docker image</h5>
    </a>
    <a href="https://grafana.com/docs/grafana-cloud/" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-cloud">
        </div>
        <h5>Grafana Cloud</h5>
    </a>
    <a href="https://grafana.com/grafana/nightly?edition=oss" class="nav-cards__item nav-cards__item--install">
        <div class="nav-cards__icon fa fa-moon-o">
        </div>
        <h5>Nightly builds</h5>
    </a>
</div>

## Guides

<div class="nav-cards">
    <a href="{{< relref "getting-started/build-first-dashboard/" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Getting started</h4>
        <p>Learn the basics of using Grafana.</p>
    </a>
    <a href="{{< relref "fundamentals/" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Grafana fundamentals</h4>
        <p>Learn basic observability.</p>
    </a>
    <a href="{{< relref "setup-grafana/configure-grafana/" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Configure Grafana</h4>
        <p>Review the configuration and setup options.</p>
    </a>
    <a href="{{< relref "fundamentals/timeseries/" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Intro to time series</h4>
        <p>Learn about time series data.</p>
    </a>
    <a href="{{< relref "administration/provisioning/" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>Provisioning</h4>
        <p>Learn how to automate your Grafana configuration.</p>
    </a>
    <a href="{{< relref "whatsnew/whats-new-in-v10-0/" >}}" class="nav-cards__item nav-cards__item--guide">
        <h4>What's new in v10</h4>
        <p>Explore the features and enhancements in the latest release.</p>
    </a>

</div>

## Data source guides

<div class="nav-cards">
    <a href="{{< relref "datasources/graphite/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_graphite.svg" >
      <h5>Graphite</h5>
    </a>
    <a href="{{< relref "datasources/elasticsearch/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_elasticsearch.svg" >
      <h5>Elasticsearch</h5>
    </a>
    <a href="{{< relref "datasources/influxdb/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_influxdb.svg" >
      <h5>InfluxDB</h5>
    </a>
    <a href="{{< relref "datasources/prometheus/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_prometheus.svg" >
      <h5>Prometheus</h5>
    </a>
    <a href="{{< relref "datasources/google-cloud-monitoring/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_cloudmonitoring.svg">
      <h5>Google Cloud Monitoring</h5>
    </a>
    <a href="{{< relref "datasources/aws-cloudwatch/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_cloudwatch.svg">
      <h5>AWS CloudWatch</h5>
    </a>
    <a href="{{< relref "datasources/azure-monitor/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_azure_monitor.jpg">
      <h5>Azure Monitor</h5>
    </a>
    <a href="{{< relref "datasources/loki/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_loki.svg">
      <h5>Loki</h5>
    </a>
    <a href="{{< relref "datasources/mysql/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_mysql.png" >
      <h5>MySQL</h5>
    </a>
    <a href="{{< relref "datasources/postgres/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_postgres.svg" >
      <h5>Postgres</h5>
    </a>
    <a href="{{< relref "datasources/mssql/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/sql_server_logo.svg">
      <h5>Microsoft SQL Server</h5>
    </a>
    <a href="{{< relref "datasources/opentsdb/" >}}" class="nav-cards__item nav-cards__item--ds">
      <img src="/static/img/docs/logos/icon_opentsdb.png" >
      <h5>OpenTSDB</h5>
    </a>
</div>
