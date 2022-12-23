---
aliases:
  - ../../features/panels/geomap/heatmap/
  - ../../panels/visualizations/geomap/heatmap/
description: Heatmap layer
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: Heatmap layer
weight: 2
---

# Heatmap layer

The heatmap layer clusters various data points to visualize locations with different densities.
To add a heatmap layer:

Click on the drop-down menu under Data Layer and choose `Heatmap`.

Similar to `Markers`, you are prompted with various options to determine which data points to visualize and how you want to visualize them.

![Heatmap Layer](/static/img/docs/geomap-panel/geomap-heatmap-8-1-0.png)

![Heatmap Layer Options](/static/img/docs/geomap-panel/geomap-heatmap-options-8-1-0.png)

- **Weight values** configure the intensity of the heatmap clusters. `Fixed value` keeps a constant weight value throughout all data points. This value should be in the range of 0~1. Similar to Markers, there is an alternate option in the drop-down to automatically scale the weight values depending on data values.
- **Radius** configures the size of the heatmap clusters.
- **Blur** configures the amount of blur on each cluster.
