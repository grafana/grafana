---
aliases:
  - ../panels/
  - ../panels/configure-thresholds/
  - ../panels/specify-thresholds/about-thresholds/
  - ../panels/specify-thresholds/add-a-threshold/
  - ../panels/specify-thresholds/add-threshold-to-graph/
  - ../panels/specify-thresholds/delete-a-threshold/
  - ../panels/thresholds/
description: Configure thresholds in your visualizations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure thresholds
title: Configure thresholds
weight: 100
refs:
  table:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table/
  histogram:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/histogram/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram/
  bar-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  trend:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/trend/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend/
  geomap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap/
  stat:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/stat/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat/
  state-timeline:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline/
  gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge/
  bar-gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-gauge/
  canvas:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/canvas/
  candlestick:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/candlestick/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick/
  status-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/status-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history/
---

# Configure thresholds

In dashboards, a threshold is a value or limit you set for a metric that's reflected visually when it's met or exceeded. Thresholds are one way you can conditionally style and color your visualizations based on query results.

Using thresholds, you can color grid lines and regions in a time series visualization:
![Time series visualization with green, blue, and purple threshold lines and regions](/media/docs/grafana/panels-visualizations/screenshot-thresholds-lines-regions-v10.4.png)

You can color the background or value text in a stat visualization:
![Stat visualization with three values in green and orange](/media/docs/grafana/panels-visualizations/screenshot-thresholds-value-v10.4.png)

You can define regions and region colors in a state timeline:
![State timeline with green, blue, and pink region thresholds](/media/docs/grafana/panels-visualizations/screenshot-thresholds-state-timeline-v10.4.png)

You can also use thresholds to:

- Color lines in a time series visualization
- Color the gauge and threshold markers in a gauge
- Color markers in a geomap
- Color cell text or background in a table

{{< docs/play title="Threshold example" url="https://play.grafana.org/d/000000167/" >}}

## Supported visualizations

You can set thresholds in the following visualizations:

{{< column-list >}}

- [Bar chart](ref:bar-chart)
- [Bar gauge](ref:bar-gauge)
- [Candlestick](ref:candlestick)
- [Canvas](ref:canvas)
- [Gauge](ref:gauge)
- [Geomap](ref:geomap)
- [Histogram](ref:histogram)
- [Stat](ref:stat)
- [State timeline](ref:state-timeline)
- [Status history](ref:status-history)
- [Table](ref:table)
- [Time series](ref:time-series)
- [Trend](ref:trend)

{{< /column-list >}}

## Default thresholds

On visualizations that support thresholds, Grafana has the following default threshold settings:

- 80 = red
- Base = green
- Mode = Absolute
- Show thresholds = Off (for some visualizations); for more information, see the [Show thresholds](#show-thresholds) option.

## Thresholds options

You can set the following options to further define how thresholds look.

### Threshold value

This number is the value that triggers the threshold. You can also set the color associated with the threshold in this field.

The **Base** value represents minus infinity. By default, it's set to the color green, which is generally the “good” color.

### Thresholds mode

There are two threshold modes:

- **Absolute** thresholds are defined by a number. For example, 80 on a scale of 1 to 150.
- **Percentage** thresholds are defined relative to minimum or maximum. For example, 80 percent.

### Show thresholds

{{< admonition type="note" >}}
This option is supported for the bar chart, candlestick, time series, and trend visualizations.
{{< /admonition>}}

Set if and how thresholds are shown with the following options.

| Option                               | Example                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off                                  |                                                                                                                                                                                                      |
| As lines                             | {{< figure max-width="500px" src="/media/docs/grafana/panels-visualizations/screenshot-thresholds-lines-v10.4.png" alt="Visualization with threshold as a line" >}}                                  |
| As lines (dashed)                    | {{< figure max-width="500px" src="/media/docs/grafana/panels-visualizations/screenshot-thresholds-dashed-lines-v10.4.png" alt="Visualization with threshold as a dashed line" >}}                    |
| As filled regions                    | {{< figure max-width="500px" src="/media/docs/grafana/panels-visualizations/screenshot-thresholds-regions-v10.4.png" alt="Visualization with threshold as a region" >}}                              |
| As filled regions and lines          | {{< figure max-width="500px" src="/media/docs/grafana/panels-visualizations/screenshot-thresholds-lines-regions-v10.4.png" alt="Visualization with threshold as a region and line" >}}               |
| As filled regions and lines (dashed) | {{< figure max-width="500px" src="/media/docs/grafana/panels-visualizations/screenshot-thresholds-dashed-lines-regions-v10.4.png" alt="Visualization with threshold as a region and dashed line" >}} |

## Add a threshold

You can add as many thresholds to a visualization as you want. Grafana automatically sorts thresholds values from highest to lowest.

1. Navigate to the panel you want to update.
1. Hover over any part of the panel you want to work on to display the menu on the top right corner.
1. Click the menu and select **Edit**.
1. Scroll to the **Thresholds** section or enter `thresholds` in the search bar at the top of the panel edit pane.
1. Click **+ Add threshold**.
1. Enter a new threshold value or use the up and down arrows at the right side of the field to increase or decrease the value incrementally.
1. Click the colored circle to the left of the threshold value to open the color picker, where you can update the threshold color.
1. Under **Thresholds mode**, select either **Absolute** or **Percentage**.
1. Under **Show thresholds**, set how the threshold is displayed or turn it off.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.

To delete a threshold, navigate to the panel that contains the threshold and click the trash icon next to the threshold you want to remove.
