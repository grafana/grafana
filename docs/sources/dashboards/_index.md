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
  title: Dashboards
  level: 1
  image: /media/docs/grafana-cloud/alerting-and-irm/grafana-cloud-docs-hero-alerts-irm.svg
  width: 110
  height: 110
  description: >-
    Dashboards allow you to query, visualize, alert on, and understand your data no matter where it’s stored. Translate and transform any of your data into flexible and versatile dashboards.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Build dashboards
      href: /docs/grafana/latest/dashboards/build-dashboards/
      description: Get step-by-step directions for how to create or import your first dashboard and modify dashboard settings. Learn how to create and manage reusable library panels, configure dashboard links, annotate visualizations, and use the dashboard JSON. 
      height: 24
    - title: Manage dashboards
      href: /docs/grafana/latest/dashboards/manage-dashboards/
      description: Learn about dashboard management and generative AI features for dashboards
      height: 24
    - title: Variables
      href: /docs/grafana/latest/dashboards/variables/
      description: Add variables to metric queries and panel titles to create interactive and dynamic dashboards
      height: 24
    - title: Public dashboards
      href: /docs/grafana/latest/dashboards/dashboard-public/
      description: Make your Grafana dashboards public and share them with anyone
      height: 24
    - title: Reporting
      href: /docs/grafana/latest/dashboards/create-reports/
      description: Generate and share PDF reports from your Grafana dashboards
      height: 24
      - title: Sharing
      href: /docs/grafana/latest/dashboards/share-dashboards-panels/
      description: Share Grafana dashboards and panels within your organization and publicly
      height: 24
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

A dashboard is a set of one or more [panels][] organized and arranged into one or more rows. Grafana ships with a variety of panels making it easy to construct the right queries, and customize the visualization so that you can create the perfect dashboard for your need. Each panel can interact with data from any configured Grafana [data source][].

Dashboard snapshots are static. Queries and expressions cannot be re-executed from snapshots. As a result, if you update any variables in your query or expression, it will not change your dashboard data.

Before you begin, ensure that you have configured a data source. See also:

{{< card-grid key="cards" type="simple" >}}

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
