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
  width: 110
  height: 110
  description: >-
    Dashboards allow you to query, transform, visualize, and understand your data no matter where it's stored.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Build dashboards
      href: ./build-dashboards/
      description: Get step-by-step directions for how to create or import your first dashboard and modify dashboard settings. Learn about reusable library panels, dashboard links, annotations, and dashboard JSON.
      height: 24
    - title: Manage dashboards
      href: ./manage-dashboards/
      description: Learn about dashboard and folder management, as well as generative AI features for dashboards.
      height: 24
    - title: Variables
      href: ./variables/
      description: Add variables to metric queries and panel titles to create interactive and dynamic dashboards.
      height: 24
    - title: Reporting
      href: ./create-reports/
      description: Automatically generate and share PDF reports from your Grafana dashboards.
      height: 24
    - title: Sharing
      href: ./share-dashboards-panels/
      description: Share Grafana dashboards and panels using links, snapshots, embeds, and exports.
      height: 24
    - title: Shared dashboards
      href: ./share-dashboards-panels/shared-dashboards/
      description: Share your dashboards with anyone without requiring access to your Grafana organization.
      height: 24
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

<section id="dashboard-overview">

A Grafana dashboard is a set of one or more [panels](/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-overview/), organized and arranged into one or more rows, that provide an at-a-glance view of related information. These panels are created using components that query and transform raw data from a data source into charts, graphs, and other visualizations.

A data source can be an SQL database, Grafana Loki, Grafana Mimir, or a JSON-based API. It can even be a basic CSV file. Data source plugins take a query you want answered, retrieve the data from the data source, and reconcile the differences between the data model of the data source and the data model of Grafana dashboards.

</section>

Queries allow you to reduce the entirety of your data to a specific dataset, providing a more manageable visualization. Since data sources have their own distinct query languages, Grafana dashboards provide you with a query editor to accommodate these differences.

A panel is the container that displays the visualization and provides you with various controls to manipulate it. Panel options let you customize many aspects of a visualization and the options differ based on which visualization you select. When the data format in a visualization doesn't meet your requirements, you can apply a transformation that manipulates the data returned by a query.

With 150+ data source plugins, you can unify all your data sources into a single dashboard to streamline data monitoring and troubleshooting. With Grafana, you can translate, transform, and visualize data in flexible and versatile dashboards.

## Explore

{{< card-grid key="cards" type="simple" >}}
