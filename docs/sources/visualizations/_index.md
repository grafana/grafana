---
aliases:
  - /docs/grafana-cloud/visualization/
  - /docs/grafana-cloud/visualizations/
description: Learn how to build dashboards and visualizations.
menuTitle: Visualize data
title: Visualize your data in Grafana Cloud
hero:
  title: Visualize data
  level: 1
  width: 100
  height: 100
  description: Easily collect, correlate, and visualize data with beautiful dashboards using Grafana Cloud&mdash;the solution that drives informed decisions, enhances system performance, and streamlines troubleshooting.
cards:
  items:
    - description: Allow you to query, transform, visualize, and understand your data no matter where it’s stored.
      height: 24
      href: /docs/grafana-cloud/visualizations/dashboards/
      title: Dashboards
    - description: Allow you to easily collect, correlate, and visualize data so you can make informed decisions in real time.
      height: 24
      href: /docs/grafana-cloud/visualizations/panels-visualizations/
      title: Panels and visualizations
    - description: Use the Drilldown apps to explore your telemetry data with a queryless experience.
      height: 24
      href: /docs/grafana-cloud/visualizations/simplified-exploration/
      title: Drilldown apps

weight: 500
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

A Grafana dashboard is a set of one or more panels that provide an at-a-glance view of related information. These panels are the basic building block in Grafana dashboards, and they're created using components that query and transform raw data from a data source into charts, graphs, and other visualizations.

A data source can be an SQL database, Grafana Loki, Grafana Mimir, or a JSON-based API. It can even be a basic CSV file. Queries allow you to reduce the entirety of your data to a specific dataset, providing a more manageable visualization. Data source plugins take a query you want answered, retrieve the data from the data source, and reconcile the differences between the data model of the data source and the data model of Grafana dashboards.

The growing suite of Grafana visualizations, ranging from time series graphs to heatmaps to cutting-edge 3D charts, provide you several different ways to present your data within a panel, depending on what best suits the data and your needs. If the data format in a visualization doesn’t meet your requirements, you can apply a transformation that manipulates the data returned by a query.

With 150+ data source plugins, you can unify all your data sources into a single dashboard to streamline data monitoring and troubleshooting. With Grafana, you can translate, transform, and visualize data in flexible and versatile dashboards.

## Explore

{{< card-grid key="cards" type="simple" >}}
