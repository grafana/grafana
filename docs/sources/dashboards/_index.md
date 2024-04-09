---
aliases:
  - features/dashboard/dashboards/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Dashboards
weight: 70
description: Create and manage dashboards
hero:
  title: Alerts and IRM
  level: 1
  image: /media/docs/grafana-cloud/alerting-and-irm/grafana-cloud-docs-hero-alerts-irm.svg
  width: 110
  height: 110
  description: >-
    Alerts & IRM is Grafana Cloud’s Incident Response Management (IRM) solution, which enables you to detect, respond, and learn from incidents in one centralized platform.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Grafana Alerting
      href: /docs/grafana-cloud/alerting-and-irm/alerting/
      description: Allows you to learn about problems in your systems moments after they occur. Monitor your incoming metrics data or log entries and set up your Alerting system to watch for specific events or circumstances and then send notifications when those things are found.
      logo: /media/docs/grafana-cloud/alerting-and-irm/grafana-icon-alerting.svg
      height: 24
    - title: Grafana SLO
      href: /docs/grafana-cloud/alerting-and-irm/slo/
      description: Provides a framework for measuring the quality of service you provide to users. Use SLOs to collect data on the reliability of your systems over time and as a result, help engineering teams reduce alert fatigue, focus on reliability, and provide better service to your customers.
      logo: /media/docs/grafana-cloud/alerting-and-irm/grafana-icon-slo.svg
      height: 24
    - title: Grafana OnCall
      href: /docs/grafana-cloud/alerting-and-irm/oncall/
      description: Enable a developer-first workflow to easily create and manage on-call schedules. Automate escalations, define alert rules and integrate seamlessly with existing alerting sources and monitoring tools.
      logo: /media/docs/grafana-cloud/alerting-and-irm/grafana-icon-oncall.svg
      height: 24
    - title: Grafana Incident
      href: /docs/grafana-cloud/alerting-and-irm/incident/
      description: Leverage the Incident tool to quickly assign roles and document learnings from chat ops/UI. Benefit from integrations with your favorite tools, such as GitHub, Slack, and Google Suite.
      logo: /media/docs/grafana-cloud/alerting-and-irm/grafana-icon-incident.svg
      height: 24
    - title: Grafana Machine Learning
      href: /docs/grafana-cloud/alerting-and-irm/machine-learning/
      description: Leverage ML features in Grafana Cloud to learn patterns in your data and get predictive insights for your time series. These forecasts can inform the creation of alerts, forecast capacity requirements, and identify anomalous activities.
      logo: /media/docs/grafana-cloud/alerting-and-irm/grafana-icon-ml.svg
      height: 24
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

A dashboard is a set of one or more [panels][] organized and arranged into one or more rows. Grafana ships with a variety of panels making it easy to construct the right queries, and customize the visualization so that you can create the perfect dashboard for your need. Each panel can interact with data from any configured Grafana [data source][].

Dashboard snapshots are static. Queries and expressions cannot be re-executed from snapshots. As a result, if you update any variables in your query or expression, it will not change your dashboard data.

Before you begin, ensure that you have configured a data source. See also:

{{< card-grid key="cards" type="simple" >}}

- [Use dashboards][]
- [Build dashboards][]
- [Create dashboard folders][]
- [Manage dashboards][]
- [Public dashboards][]
- [Annotations][]
- [Playlist][]
- [Reporting][]
- [Version history][]
- [Import][]
- [Export and share][]
- [JSON model][]

{{% docs/reference %}}
[data source]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources"
[data source]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/connect-externally-hosted/data-sources"

[Reporting]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/create-reports"
[Reporting]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/create-reports"

[Public dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/dashboard-public"
[Public dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/dashboard-public"

[Version history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/manage-version-history"
[Version history]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-version-history"

[panels]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"
[panels]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations"

[Annotations]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/annotate-visualizations"
[Annotations]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations"

[Create dashboard folders]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/manage-dashboards#create-a-dashboard-folder"
[Create dashboard folders]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/manage-dashboards#create-a-dashboard-folder"

[JSON model]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/view-dashboard-json-model"
[JSON model]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/view-dashboard-json-model"

[Import]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/import-dashboards"
[Import]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/import-dashboards"

[Export and share]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/share-dashboards-panels"
[Export and share]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels"

[Manage dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/manage-dashboards"
[Manage dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/manage-dashboards"

[Build dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"
[Build dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards"

[Use dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/use-dashboards"
[Use dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/use-dashboards"

[Playlist]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/create-manage-playlists"
[Playlist]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/create-manage-playlists"
{{% /docs/reference %}}
