---
aliases:
  - ../../features/panels/candlestick/
  - ../../panels/visualizations/candlestick/
  - ../../visualizations/candlestick/
description: Configure options for Grafana's candlestick visualization
keywords:
  - grafana
  - Candlestick
  - OHLC
  - panel
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Candlestick
weight: 100
refs:
  time-series-visualization:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
---

# Candlestick

The candlestick visualization allows you to visualize data that includes a number of consistent dimensions focused on price movements, such as stock prices. The candlestick visualization includes an [Open-High-Low-Close (OHLC) mode](#open-high-low-close), as well as support for additional dimensions based on time series data.

Candlestick visualizations build upon the foundation of the [time series visualization](ref:time-series-visualization) and include many common configuration settings.

You can use a candlestick if you want to visualize, at a glance, how a price moved over time, whether it went up, down, or stayed the same, and how much it fluctuated:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-candlestick-v11.6.png" max-width="750px" alt="A candlestick visualization" >}}

Each candlestick is represented as a rectangle, referred to as the _candlestick body_. The candlestick body displays the opening and closing prices during a time period. Green candlesticks represent when the price appreciated while the red candlesticks represent when the price depreciated. The lines sticking out the candlestick body are referred to as _wicks_ or _shadows_, which represent the highest and lowest prices during the time period.

Use a candlestick when you need to:

- Monitor and identify trends in price movements of specific assets such as stocks, currencies, or commodities.
- Analyze any volatility in the stock market.
- Provide data analysis to help with trading decisions.

## Configure a candlestick

Once you’ve created a [dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/), the following video shows you how to configure a candlestick visualization:

{{< youtube id="IOFKBgbf3aM" >}}

{{< docs/play title="Candlestick" url="https://play.grafana.org/d/candlestick/candlestick" >}}

## Supported data formats

The candlestick visualization works best with price movement data for an asset. The data must include:

- **Timestamps** - The time at which each price movement occurred.
- **Opening price** - The price of the asset at the beginning of the time period.
- **Closing price** - The price of the asset at the end of the time period.
- **Highest price** - The highest price the asset reached during the time period.
- **Lowest price** - The lowest price the asset reached during the time period.

### Example

| Timestamps          | Open  | High  | Low   | Close |
| ------------------- | ----- | ----- | ----- | ----- |
| 2024-03-13 10:05:00 | 0.200 | 0.205 | 0.201 | 0.203 |
| 2024-03-14 10:10:10 | 0.204 | 0.205 | 0.201 | 0.200 |
| 2024-03-15 10:15:10 | 0.204 | 0.205 | 0.201 | 0.200 |
| 2024-03-16 10:20:11 | 0.203 | 0.203 | 0.202 | 0.203 |
| 2024-03-17 10:25:11 | 0.203 | 0.203 | 0.202 | 0.203 |
| 2024-03-18 10:30:12 | 0.202 | 0.202 | 0.201 | 0.201 |

The data is converted as follows:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-candles-volume-v11.6.png" max-width="750px" alt="A candlestick visualization showing the price movements of specific asset." >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Candlestick options

The following options let you control which data is displayed in the visualization and how it appears:

| Option                                                 | Description                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode                                                   | Controls which dimensions are used for the visualization. Choose from:<ul><li>**Candles** - Uses the open, high, low, and close dimensions.</li><li>**Volume** - Uses only the volume dimension.</li><li>**Both** - The default behavior, which displays both candles and volume values.</li></ul>    |
| Candle style                                           | Controls the appearance of the candles. Choose from:<ul><li>**Candles** - The default display style, which creates candle-style markers between the open and close dimensions.</li><li>**OHLC Bars** - Displays values for the four core dimensions, open, high, low, and close.</li></ul>            |
| [Color strategy](#color-strategy)                      | Controls how colors are applied to dimensions. Choose from:<ul><li>**Since Open** - This mode uses the **Up color** if the intra-period price movement is positive.</li><li>**Since Prior Close** - The color of the candle is based on the inter-period price movement or change in value.</li></ul> |
| Up color/Down color                                    | These options control which colors are used when the price movement is up or down. Note that the **Color strategy** selection determines if intra-period or inter-period price movement is used to select the candle or OHLC bar color.                                                               |
| [Open, High, Low, Close, Volume](#open-high-low-close) | The candlestick visualization attempts to map fields from your data to these dimensions, as appropriate dimension.                                                                                                                                                                                    |
| [Additional fields](#additional-fields)                | The **Include** and **Ignore** options allow the candlestick visualization to display other included data such as simple moving averages, Bollinger bands and more, using the same styles and configurations available in the [time series](ref:time-series-visualization) visualization.             |

#### Color strategy

The **Color strategy** option controls how colors are applied to dimensions. Choose from:

- **Since Open** - The default behavior. This mode uses the **Up color** if the intra-period price movement is positive. In other words, if the value on close is greater or equal to the value on open, the **Up color** is used.
- **Since Prior Close** - An alternative display method where the color of the candle is based on the inter-period price movement or change in value. In other words, if the value on open is greater than the previous value on close, the **Up color** is used. If the value on open is lower than the previous value on close, the **Down color** is used.

  This option also triggers the _hollow candlestick_ visualization mode. Hollow candlesticks indicate that the intra-period movement is positive (value is higher on close than on open), while filled candlesticks indicate the intra-period change is negative (value is lower on close than on open). To learn more, refer to the [explanation of the differences](https://thetradingbible.com/how-to-read-hollow-candlesticks).

#### Open, High, Low, Close, Volume {#open-high-low-close}

The candlestick visualization attempts to map fields from your data to the appropriate dimension:

- **Open** - Starting value of the given period.
- **High** - Highest value of the given period.
- **Low** - Lowest value of the given period.
- **Close** - Final (end) value of the given period.
- **Volume** - Sample count in the given period (for example, number of trades).

{{% admonition type="note" %}}
The candlestick visualization legend doesn't display these values.
{{% /admonition %}}

If your data can't be mapped to these dimensions for some reason (for example, because the column names aren't the same), you can map them manually using the **Open**, **High**, **Low**, and **Close** fields under the **Candlestick** options in the panel editor:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-olhc-options-v11.6.png" max-width="400px" alt="Open, High, Low, and Close fields in the panel editor" >}}

#### Additional fields

The candlestick visualization is based on the time series visualization, and it can visualize additional data dimensions beyond open, high, low, close, and volume.
The **Include** and **Ignore** options allow it to visualize other included data such as simple moving averages, Bollinger bands and more, using the same styles and configurations available in the [time series](ref:time-series-visualization) visualization.

### Tooltip options

Tooltip options control the information overlay that appears when you hover over data points in the visualization.

| Option                                  | Description                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [Tooltip mode](#tooltip-mode)           | When you hover your cursor over the visualization, Grafana can display tooltips. Choose how tooltips behave.                   |
| [Values sort order](#values-sort-order) | This option controls the order in which values are listed in a tooltip.                                                        |
| [Hover proximity](#hover-proximity)     | Set the hover proximity (in pixels) to control how close the cursor must be to a data point to trigger the tooltip to display. |
| Max width                               | Set the maximum width of the tooltip box.                                                                                      |
| Max height                              | Set the maximum height of the tooltip box. The default is 600 pixels.                                                          |

#### Tooltip mode

When you hover your cursor over the visualization, Grafana can display tooltips. Choose how tooltips behave.

- **Single -** The hover tooltip shows only a single series, the one that you are hovering over on the visualization.
- **All -** The hover tooltip shows all series in the visualization. Grafana highlights the series that you are hovering over in bold in the series list in the tooltip.
- **Hidden -** Do not display the tooltip when you interact with the visualization.

Use an override to hide individual series from the tooltip.

#### Values sort order

When you set the **Tooltip mode** to **All**, the **Values sort order** option is displayed. This option controls the order in which values are listed in a tooltip. Choose from the following:

- **None** - Grafana automatically sorts the values displayed in a tooltip.
- **Ascending** - Values in the tooltip are listed from smallest to largest.
- **Descending** - Values in the tooltip are listed from largest to smallest.

#### Hover proximity

Set the hover proximity (in pixels) to control how close the cursor must be to a data point to trigger the tooltip to display.

![Adding a hover proximity limit for tooltips](/media/docs/grafana/gif-grafana-10-4-hover-proximity.gif)

### Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Graph styles options

The options under the **Graph styles** section let you control the general appearance of [additional fields](#additional-fields) in the visualization, excluding [color](#standard-options).

{{< docs/shared lookup="visualizations/graph-styles-options.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
