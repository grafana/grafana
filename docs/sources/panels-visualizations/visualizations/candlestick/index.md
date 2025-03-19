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

{{< figure src="/static/img/docs/candlestick-panel/candlestick-panel-8-3.png" max-width="1065px" alt="A candlestick visualization" >}}

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

{{< figure src="/static/img/docs/candlestick-panel/candlestick.png" max-width="1065px" alt="A candlestick visualization showing the price movements of specific asset." >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Mode

The mode options allow you to toggle which dimensions are used for the visualization.

- **Candles** limits the panel dimensions to the open, high, low, and close dimensions used by candlestick visualizations.
- **Volume** limits the panel dimension to the volume dimension.
- **Both** is the default behavior for the candlestick visualization. It includes both candlestick and volume visualizations.

## Candle style

- **Candles** is the default display style and creates candle-style visualizations between the open and close dimensions.
- **OHLC Bars** displays the four core dimensions open, high, low, and close values.

## Color strategy

- **Since Open** is the default behavior. This mode will utilize the _Up_ color (below) if the intra-period price movement is positive. In other words, if the value on close is greater or equal to the value on open, the _Up_ color is used.
- **Since Prior Close** is an alternative display method based where the color of the candle is based on the inter-period price movement or change in value. In other words, if the value on open is greater than the previous value on close, the _Up_ color is used. If the value on open is lower than the previous value on close, the _Down_ color is used. _This option also triggers the hollow candlestick visualization mode_. Hollow candlesticks indicate that the intra-period movement is positive (value is higher on close than on open), filled candlesticks indicate the intra-period change is negative (value is lower on close than on open). To learn more, see the [explanation of the differences](https://thetradingbible.com/how-to-read-hollow-candlesticks).

## Up & Down Colors

The **Up color** and **Down color** options select which colors are used when the price movement is up or down. Please note that the _Color strategy_ above will determine if intra-period or inter-period price movement is used to select the candle or OHLC bar color.

## Open, High, Low, Close

The candlestick visualization will attempt to map fields from your data to the appropriate dimension:

- **Open** corresponds to the starting value of the given period.
- **High** corresponds to the highest value of the given period.
- **Low** corresponds to the lowest value of the given period.
- **Close** corresponds to the final (end) value of the given period.
- **Volume** corresponds to the sample count in the given period. (for example, number of trades)

{{% admonition type="note" %}}
The candlestick visualization legend doesn't display these values.
{{% /admonition %}}

If your data can't be mapped to these dimensions for some reason (for example, because the column names aren't the same), you can map them manually using the **Open**, **High**, **Low**, and **Close** fields under the **Candlestick** options in the panel editor:

![Open, High, Low, and Close fields in the panel editor](/media/docs/grafana/panels-visualizations/screenshot-olhc-options-10.3.png)

### Additional fields

The candlestick visualization is based on the time series visualization. It can visualize additional data dimensions beyond open, high, low, close, and volume The **Include** and **Ignore** options allow it to visualize other included data such as simple moving averages, Bollinger bands and more, using the same styles and configurations available in the [time series](ref:time-series-visualization) visualization.

## Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Legend options

{{< docs/shared lookup="visualizations/legend-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-1.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
