---
aliases:
  - ../dashboards/configure-panels-visualizations/ # /docs/grafana/next/dashboards/configure-panels-visualizations/
  - ../features/panels/panels/ # /docs/grafana/next/features/panels/panels/
  - ../panels/ # /docs/grafana/next/panels/
  - ../panels-visualizations/ # /docs/grafana/next/panels-visualizations/
keywords:
  - grafana
  - configure
  - panels
  - visualizations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Panels and visualizations
title: Panels and visualizations
description: Learn about and configure panels and visualizations
weight: 80
hero:
  title: Panels and visualizations
  level: 1
  width: 110
  height: 110
  description: >-
    Easily collect, correlate, and visualize data so you can make informed decisions in real time.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Visualizations
      href: ./visualizations/
      description: Learn about all the visualizations available in Grafana, including which visualizations are ideal for different datasets and how to configure their options.
      height: 24
    - title: Panel overview
      href: ./panel-overview/
      description: Learn about the features of the panel.
      height: 24
    - title: Panel editor
      href: ./panel-editor-overview/
      description: Learn about the features of the panel editor and how to begin editing a panel.
      height: 24
    - title: Configure standard options
      href: ./configure-standard-options/
      description: Learn about configuring standard options like units, field display names, and colors.
      height: 24
    - title: Query and transform data
      href: ./query-transform-data/
      description: Learn about querying and transforming your data to refine your visualizations.
      height: 24
refs:
  query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

Panels are the basic building block in Grafana dashboards, composed of a [query](ref:query) and a visualization, a graphical representation of query results.

Visualizations provide you several different ways to present your data within a panel, depending on what best suits the data and your needs. Grafana’s growing suite of visualizations, ranging from time series graphs to heatmaps to cutting-edge 3D charts, help you decode complex datasets.

Panels offer a wide variety of formatting and styling options from applying colors based on field values to custom units. Each visualization also comes with options specific to it that give you further control over how your data is displayed. With Grafana panels and visualizations, you can easily get the information you need from your data and optimize performance.

## Explore

{{< card-grid key="cards" type="simple" >}}
