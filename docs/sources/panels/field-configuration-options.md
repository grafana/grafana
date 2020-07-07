+++
title = "Field configuration options"
type = "docs"
[menu.docs]
parent = "panels"
weight = 300
+++

# Field configuration options

This page explains what field configurations and field overrides in Grafana are and how to use them. It also includes [examples](#examples) if you need an idea of how this feature might be useful in the real world.

> **Note:** This documentation refers to a Grafana 7.0 beta feature. This documentation will be frequently updated to reflect updates to the feature, and it will probably be broken into smaller sections when the feature moves out of beta.

The data model behind Grafana, the [data frame]({{< relref "../developers/plugins/data-frames.md" >}}), is a columnar-oriented table structure.

Each column within this structure is called a _field_. Grafana allows to customize how a particular field is displayed in the visualization.

## Field configuration options and overrides

Field configuration options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data.

> **Note:** The time fields are not affected by field configuration options or overrides.

_Field configuration options_, both standard and custom, are applied in the **Field** tab in the panel editor. Changes on this panel apply to all fields in the visualization. For example, if you change the unit to percentage, then all fields with numeric values will be displayed in percentages. [Apply a field option](#configure-all-fields).

_Field overrides_ are applied in the _Overrides_ tab in the panel editor. They are exactly the same as field configuration options except that they only change fields you select. The current feature only allows you to change one field at a time, but future improvements will offer more flexibility. [Apply an override](#override-a-field).

All [field options](#field-options) are defined below.

### Standard field options

Standard field options are:

- [Unit](#unit)
- [Min](#min)
- [Max](#max)
- [Decimals](#decimals)
- [Display name](#display-name)
- [No value](#no-value)
- [Thresholds](#thresholds)
- [Value mappings](#value-mapping)
- [Data links](#data-links)

You can apply standard field options to the following panel visualizations:

- [Bar gauge]({{< relref "visualizations/bar-gauge-panel.md" >}})
- [Gauge]({{< relref "visualizations/gauge-panel.md" >}})
- [Stat]({{< relref "visualizations/stat-panel.md" >}})
- [Table]({{< relref "visualizations/table-panel.md" >}})

### Custom field options

You can only apply custom field options to table visualizations. Plugin authors can add their own custom field options as well, and they might differ across visualizations.

Custom field options are:

- [Column width](#column-width)
- [Column alignment](#column-alignment)
- [Cell display mode](#cell-display-mode)

## Configure all fields

To change how all fields display data, you apply a [field option](#field-options). Usually you apply changes that you want to most of or all of the fields here, rather than applying field overrides to exceptions.

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
1. Click the **Field** tab.
1. Find the option you want to change.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. When finished, click **Save** to save all panel edits to the dashboard.

## Override a field

Field overrides allow you to change the settings for one field (column in tables) to be different than the others. Field options for overrides are exactly the same as the field options available in a particular visualization. The only difference is that you choose which field to apply them to.

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
1. Click the **Overrides** tab.
1. Click **Add override**.
1. Select a filter option to choose which fields the override applies to.

   **Note:** Currently you can only match by name, so after you choose the filter, select which field it applies to from the dropdown list.

1. Click **Add override property**.
1. Select the [field option](#field-options) you want to apply.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add override** and select a different field to add overrides to.
1. When finished, click **Save** to save all panel edits to the dashboard.

## Field options

This section explains all available field options. They are listed in alphabetical order.

Most field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

### Cell display mode

This custom field option applies only to table visualizations.

By default, Grafana automatically chooses display settings. You can override the settings by choosing one of the following options to change all fields.

- **Color text -** If thresholds are set, then the field text is displayed in the appropriate threshold color.
- **Color background -** If thresholds are set, then the field background is displayed in the appropriate threshold color.
- **Gradient gauge -** The threshold levels define a gradient.
- **LCD gauge -** The gauge is split up in small cells that are lit or unlit.
- **JSON view -** Shows value formatted as code. If a value is an object the JSON view allowing browsing the JSON object will appear on hover

### Column alignment

This custom field option applies only to table visualizations.

Choose how Grafana should align cell contents:

- Auto (default)
- Left
- Center
- Right

### Column width

This custom field option applies only to table visualizations.

By default, Grafana automatically calculates the column width based on the cell contents. In this field option, can override the setting and define the width for all columns in pixels.

For example, if you enter `100` in the field, then when you click outside the field, all the columns will be set to 100 pixels wide.

### Decimals

Number of decimals to render value with. Leave empty for Grafana to use the number of decimals provided by the data source.

To change this setting, type a number in the field and then click outside the field or press Enter.

### Data links

Lets you control the URL to which a value or visualization link.

For more information and instructions, refer to [Data links]({{< relref "../linking/data-links.md" >}}).

### Display name

Lets you set the display title of all fields. You can use [variables]({{< relref "../variables/templates-and-variables.md" >}}) in the field title.

When multiple stats are shown, this field controls the title in each stat. By default this is the series name and field name. You can use expressions like ${__series.name} or ${**field.name} to use only series name or field name in title or \${**cell_2} to refer to other fields (2 being field/column with index 2).

### Max

Lets you set the maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields

### Min

Lets you set the minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields

### No value

Enter what Grafana should display if the field value is empty or null.

### Unit

Lets you choose what unit a field should use. Click in the **Unit** field, then drill down until you find the unit you want. The unit you select is applied to all fields except time.

### Custom units

You can use the unit dropdown to also specify custom units, custom prefix or suffix and date time formats.

To select a custom unit enter the unit and select the last `Custom: xxx` option in the dropdown.

- If y u want a space -> If you want a space
- `suffix:<suffix>` for custom unit that should go after value.
- `time:<format>` For custom date time formats type for example `time:YYYY-MM-DD`. See [formats](https://momentjs.com/docs/#/displaying/) for the format syntax and options.
- `si:<base scale><unit characters>` for custom SI units. For example: `si: mF`. This one is a bit more advanced as you can specify both a unit and the
  source data scale. So if your source data is represented as milli (thousands of) something prefix the unit with that
  SI scale character.
- `count:<unit>` for a custom count unit.
- `currency:<unit>` for custom a currency unit.

You can also paste a native emoji in the unit picker and pick it as a custom unit:

{{< docs-imagebox img="/img/docs/v66/custom_unit_burger2.png" max-width="600px" caption="Custom unit emoji" >}}

### Thresholds

Thresholds allow you to change the color of a field based on the value.

For more information and instructions, refer to [Thresholds]({{< relref "thresholds.md" >}}).

### Value mapping

Lets you set rules that translate a field value or range of values into explicit text. You can add more than one value mapping.

- **Mapping type -** Click an option.
  - **Value -** Enter a value. If the field value is greater than or equal to the value, then the **Text** is displayed.
  - **From** and **To -** Enter a range. If the field value is between or equal to the values in the range, then the **Text** is displayed.
- **Text -** Text that is displayed if the conditions are met in a field. This field accepts variables.

## Examples

Here are some examples of how you might use this feature.

## Field option example

Let’s assume that our result set is a data frame that consists of two fields: time and temperature.

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |    45.0     |
| 2020-01-02 03:05:00 |    47.0     |
| 2020-01-02 03:06:00 |    48.0     |

Each field(column) of this structure can have field options applied that alter the way its values are displayed. This means that you can, for example, set the Unit to Temperature > Celsius, resulting in the following table:

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |   45.0 °C   |
| 2020-01-02 03:05:00 |   47.0 °C   |
| 2020-01-02 03:06:00 |   48.0 °C   |

While we're at it, the decimal place doesn't add anything to this display. You can change the Decimals from `auto` to zero (`0`), resulting in the following table:

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |    45 °C    |
| 2020-01-02 03:05:00 |    47 °C    |
| 2020-01-02 03:06:00 |    48 °C    |

## Field override example

Let’s assume that our result set is a data frame that consists of four fields: time, high temp, low temp, and humidity.

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45.0      | 30.0     | 67       |
| 2020-01-02 03:05:00 | 47.0      | 34.0     | 68       |
| 2020-01-02 03:06:00 | 48.0      | 31.0     | 68       |

Let's apply the field options from the [field option example](#field-option-example) to apply the Celsius unit and get rid of the decimal place. This results in the following table:

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45 °C     | 30 °C    | 67 °C    |
| 2020-01-02 03:05:00 | 47 °C     | 34 °C    | 68 °C    |
| 2020-01-02 03:06:00 | 48 °C     | 31 °C    | 68 °C    |

The temperature fields look good, but the humidity is nonsensical. We can fix this by applying a field option override to the humidity field and change the unit to Misc > percent (0-100). This results in a table that makes a lot more sense:

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45 °C     | 30 °C    | 67%      |
| 2020-01-02 03:05:00 | 47 °C     | 34 °C    | 68%      |
| 2020-01-02 03:06:00 | 48 °C     | 31 °C    | 68%      |
