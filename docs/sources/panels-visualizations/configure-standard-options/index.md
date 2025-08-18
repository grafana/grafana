---
aliases:
  - ../panels/apply-color-to-series/
  - ../panels/configure-standard-options/
  - ../panels/field-options/
  - ../panels/field-options/standard-field-options/
  - ../panels/reference-standard-field-definitions/
  - ../panels/standard-field-definitions/
  - ../panels/working-with-panels/format-standard-fields/
  - ../panels/field-configuration-options/ # /docs/grafana/latest/panels/field-configuration-options/
keywords:
  - panel
  - dashboard
  - standard
  - option
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure standard options
title: Configure standard options
description: Configure standard options like units, min, max, and colors
weight: 60
refs:
  bar-gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-gauge/
  candlestick:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/candlestick/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick/
  canvas:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/canvas/
  threshold:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-thresholds/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-thresholds/
  trend:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/trend/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend/
  stat:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/stat/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat/
  time-series:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  pie-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/pie-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/pie-chart/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  status-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/status-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history/
  gauge:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/gauge/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge/
  state-timeline:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline/
  xy-chart:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/xy-chart/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/xy-chart/
  geomap:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap/
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
  configure-overrides:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-overrides/
---

# Configure standard options

**Standard options** in the panel editor pane let you change how field data is displayed in your visualizations. Options that you apply don't change the data, they just change how Grafana _displays_ the data.

When you set a standard option, the change is applied to all fields or series. For example, if you set the **Unit** option to **Percentage**, all fields with numeric values are displayed as percentages.

For more granular control over the display of fields, refer to [Configure overrides](ref:configure-overrides).

## Supported visualizations

You can configure standard options for the following visualizations:

{{< column-list >}}

- [Bar chart](ref:bar-chart)
- [Bar gauge](ref:bar-gauge)
- [Candlestick](ref:candlestick)
- [Canvas](ref:canvas)
- [Gauge](ref:gauge)
- [Geomap](ref:geomap)
- [Histogram](ref:histogram)
- [Pie chart](ref:pie-chart)
- [Stat](ref:stat)
- [State timeline](ref:state-timeline)
- [Status history](ref:status-history)
- [Table](ref:table)
- [Time series](ref:time-series)
- [Trend](ref:trend)
- [XY chart](ref:xy-chart)

{{< /column-list >}}

## Standard options

This section explains all available standard options.

To set these options, expand the **Standard options** section in the panel editor pane. Most field options won't affect the visualization until you click outside of the field option box you're editing or press Enter.

{{< admonition type="note" >}}
Not all of the options listed apply to all visualizations with standard options.
{{< /admonition >}}

### Unit

This option lets you choose which unit a field should use. Click in the **Unit** field, then drill down until you find the unit you want. The unit you select is applied to all fields except time.

#### Custom units

You can also use the **Unit** drop-down to specify custom units, custom prefixes or suffixes, and date time formats.

To set a custom unit, enter the unit you want to use and then select it in the drop-down. It'll be the last option listed. For example, if you enter a unit called "Hearts", the drop-down will then include the option **Custom unit: Hearts**.

You can further define a custom unit with specific syntax. For example, to set a custom currency unit called "Gems", enter `currency:Gems` in the field. The drop-down will include the option **Custom unit: currency:Gems**:

![A custom currency unit called Gems in the Unit drop-down](/media/docs/grafana/panels-visualizations/custom_unit_currency_v11.0.png)

The following table lists the special syntax options for custom units:

| Custom unit                        | Description                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suffix:<suffix>`                  | Custom unit that should go after value.                                                                                                                                                                                                                                                                                                                 |
| `prefix:<prefix>`                  | Custom unit that should go before value.                                                                                                                                                                                                                                                                                                                |
| `time:<format>`                    | Custom date time formats type, such as `time:YYYY-MM-DD`. Refer to [formats](https://momentjs.com/docs/#/displaying/) for the format syntax and options.                                                                                                                                                                                                |
| `si:<base scale><unit characters>` | Custom SI units, such as `si: mF`. You can specify both a unit and the source data scale. For example, if your source data is represented as milli-something, prefix the unit with the `m` SI scale character.                                                                                                                                          |
| `count:<unit>`                     | Custom count unit.                                                                                                                                                                                                                                                                                                                                      |
| `currency:<unit>`                  | Custom currency unit.                                                                                                                                                                                                                                                                                                                                   |
| `currency:financial:<unit>`        | Full format currency unit without abbreviations. Displays complete numeric values instead of scaled abbreviations (K: Thousand, M: Million, B: Billion, T: Trillion). For example, `currency:financial:$` displays `500,555` instead of `$501K`. Add `:suffix` to place the symbol after the number: `currency:financial:€:suffix` displays `500,555€`. |

You can also paste a native emoji in the **Unit** drop-down and select it as a custom unit:

![A thumbs up emoji as a custom unit](/media/docs/grafana/panels-visualizations/custom_unit_thumbsup_v11.0.png)

![A time series visualization using custom thumbs up emoji units](/media/docs/grafana/panels-visualizations/thumbsup_panel_v11.0.png)

##### Time format units

All **Date & time** format units in Grafana (such as **Datetime ISO** or **Datetime US**) expect input values to be in milliseconds since the Unix epoch (January 1, 1970). If your data source provides timestamps in seconds, these will be incorrectly interpreted as dates very close to January 1, 1970.

To display timestamps that are in seconds since epoch, multiply your timestamp values by 1000 using a transformation following these steps:

1. In the panel editor, click the **Transformations** tab.
1. Click **Add transformation**.
1. Select the **Add field from calculation** transformation.
1. Set the following options:
   - **Mode** - **Binary operation**
   - **Operation**
     - Select your timestamp field
     - Select the asterisk (`*`) for multiply by
     - Enter 1000 in the **Field or Number** field
   - Toggle the **Replace all fields** switch on if you want to see the calculated field.

#### Control unit scaling

By default, Grafana automatically scales the unit based on the magnitude of the value. For example, if you have values of 0.14kW and 3000kW, Grafana displays them as 140W and 3MW, respectively. You can use custom units to control this behavior by setting a prefix, suffix, or custom SI unit.

#### String units

Sometimes Grafana is too aggressive in interpreting strings and displaying them as numbers. To configure Grafana to show the original string value, select **Misc > String** in the **Unit** drop-down.

### Min

Set the minimum value used in percentage threshold calculations. Leave this field empty to automatically calculate the minimum.

### Max

Set the maximum value used in percentage threshold calculations. Leave this field empty to automatically calculate the maximum.

### Field min/max

By default, the calculated **Min** and **Max** are based on the minimum and maximum of all series and fields. When you enable **Field min/max**, Grafana calculates the min or max of each field individually, based on the minimum or maximum value of the field.

### Decimals

Specify the number of decimals Grafana includes in the rendered value. If you leave this field empty, Grafana automatically truncates the number of decimals based on the value. For example 1.1234 displays as 1.12 and 100.456 displays as 100.

To display all decimals, set the unit to **String**.

### Display name

Set the display title of all fields. You can use [variables](ref:variables) in the field title.

When multiple stats, fields, or series are displayed, this field controls the title in each stat. You can use expressions like `${__field.name}` to use only the series name or the field name in the title.

The following table shows examples of the different field names generated using various expressions. In this example, there's a field with a name of "Temp" and labels of {"Loc"="PBI", "Sensor"="3"}:

| Expression syntax            | Example                 | Renders to                     | Explanation                                                                                                                                                                                                        |
| ---------------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `${__field.displayName}`     | Same as syntax          | `Temp {Loc="PBI", Sensor="3"}` | Displays the field name, and labels in `{}` if they are present. If there is only one label key in the response, then for the label portion, Grafana displays the value of the label without the enclosing braces. |
| `${__field.name}`            | Same as syntax          | `Temp`                         | Displays the name of the field (without labels).                                                                                                                                                                   |
| `${__field.labels}`          | Same as syntax          | `Loc="PBI", Sensor="3"`        | Displays the labels without the name.                                                                                                                                                                              |
| `${__field.labels.X}`        | `${__field.labels.Loc}` | `PBI`                          | Displays the value of the specified label key.                                                                                                                                                                     |
| `${__field.labels.__values}` | Same as Syntax          | `PBI, 3`                       | Displays the values of the labels separated by a comma (without label keys).                                                                                                                                       |

If the value is an empty string after rendering the expression for a particular field, then the default display method is applied.

### Color scheme

The **Color scheme** options let you set single or multiple colors for your entire visualization.

The color options and their effect on a visualization depend on the visualization you're working with and some visualizations have different color options.

Select one of the following schemes:

| Color scheme                          | Description                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single color                          | Specifies a single color.                                                                                                                                                                                                                                                                                                                                                                                   |
| Shades of a color                     | Grafana selects shades of a single color.                                                                                                                                                                                                                                                                                                                                                                   |
| From thresholds (by value)            | The color is taken from the matching [threshold](ref:threshold). For some visualizations, you also need to choose if the color is set by the **Last**, **Min**, or **Max** value of the field or series.                                                                                                                                                                                                    |
| Classic palette                       | Grafana automatically assigns a color for each field or series based on its order. If the order of a field changes in your query, the color also changes. Useful for graphs, pie charts, and other categorical data visualizations.                                                                                                                                                                         |
| Classic palette (by series name)      | Grafana automatically assigns colors based on the name of the series. Useful when the series names to be visualized can change based on the available data.                                                                                                                                                                                                                                                 |
| Multiple continuous colors (by value) | Grafana automatically assigns colors based on the percentage of a value relative to the min and the max of the field or series. For some visualizations, you also need to choose if the color is set by the **Last**, **Min**, or **Max** value of the field or series. Select from: **Green-Yellow-Red**, **Red-Yellow-Green**, **Blue-Yellow-Red**, **Yellow-Red**, **Blue-Purple**, and **Yellow-Blue**. |
| Single continuous color (by value)    | Grafana automatically assigns shades of one color based on the percentage of a value relative to the min and the max of the field or series. For some visualizations, you also need to choose if the color is set by the **Last**, **Min**, or **Max** value of the field or series. Select from: **Blues**, **Reds**, **Greens**, and **Purples**.                                                         |

You can also use the legend to open the color picker by clicking the legend series color icon. Setting color this way automatically creates an override rule that set's a specific color for a specific series.

### No value

Enter what Grafana should display if the field value is empty or null. The default value is a hyphen (-).
