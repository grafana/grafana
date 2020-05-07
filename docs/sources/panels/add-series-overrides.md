+++
title = "Add series overrides"
type = "docs"
[menu.docs]
parent = "panels"
weight = 500
+++

# Add series overrides

> **Note:** This documentation refers to a feature only available in Grafana 7.0 beta.

The feature allows a series in a graph panel to be rendered differently from the others. You can customize display options on a per-series bases or by using regex rules. For example, one series can be given a thicker line width to make it stand out or be moved to the right Y-axis.

You can add multiple series overrides.

1. Navigate to the graph panel you want to add a series override to.
1. Click the panel title and then click **Edit** or press **e**.
1. On the Panel tab, scroll down to click **Series overrides** to expand the section.
1. Click **Add series override**.
1. In **Alias or regex** Type or select a series. Click in the field to see available series.
1. Click **+** and then select a style to apply to the series. You can add multiple styles to each entry.
   - **Bars -** 
   - **Lines**
   - **Line fill**
   - **Fill gradient**
   - **Line width**
   - **Null point mode**
   - **Fill below to**
   - **Staircase line**
   - **Dashes**
   - **Hidden Series**
   - **Dash Length**
   - **Dash Space**
   - **Points**
   - **Point Radius**
   - **Stack**
   - **Color**
   - **Y-axis**
   - **Z-index**
   - **Transform**
   - **Legend**
   - **Hide in tooltip**
