---
aliases:
  - /docs/sources/panels/specify-thresholds/about-thresholds/
title: About thresholds
weight: 10
---

# About thresholds

Thresholds set the color of either the value text or the background based on conditions that you define.

There are two types of thresholds:

- **Absolute** thresholds are defined based on a number. For example, 80 on a scale of 1 to 150.
- **Percentage** thresholds are defined relative to minimum or maximum. For example, 80 percent.

You can apply thresholds to most, but not all, visualizations.

## Default thresholds

On visualizations that support it, Grafana sets default threshold values of:

- 80 = red
- Base = green
- Mode = Absolute

The **Base** value represents minus infinity. It is generally the “good” color.
