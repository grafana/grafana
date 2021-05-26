+++
title = "Field options and overrides"
keywords = ["grafana", "field options", "documentation", "format fields"]
aliases = ["/docs/grafana/latest/panels/field-configuration-options/", "/docs/grafana/latest/panels/field-options/"]
weight = 500
+++

# Field options and overrides

This section explains what field options and field overrides in Grafana are and how to use them. It also includes [examples](#examples) if you need an idea of how this feature might be useful.

The data model used in Grafana, the [data frame]({{< relref "../../developers/plugins/data-frames.md" >}}), is a columnar-oriented table structure that unifies both time series and table query results. Each column within this structure is called a _field_. A field can represent a single time series or table column.

Field options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data.

## Field options

_Field options_, both standard and custom, can be found in the Field tab in the panel editor. Changes on this tab apply to all fields (i.e. series/columns). For example, if you change the unit to percentage, then all fields with numeric values are displayed in percentages. Learn how to apply a field option in [Configure all fields]({{< relref "configure-all-fields.md" >}}).

## Field overrides

_Field overrides_ can be added in the Overrides tab in the panel editor. There you can add the same options as you find in the Field tab, but they are only applied to specific fields. Learn how to apply an override in [Configure specific fields]({{< relref "configure-specific-fields.md" >}}).

## Available field options and overrides

Field option types are common to both field options and field overrides. The only difference is whether the change will apply to all fields (apply in the Field tab) or to a subset of fields (apply in the Overrides tab).

- [Standard options]({{< relref "../standard-options.md" >}}) apply to all panel visualizations that allow transformations.
- [Table field options]({{< relref "../visualizations/table/table-field-options.md" >}}), which only apply to table panel visualizations.

## Field option example

Let’s assume that our result set is a data frame that consists of two fields: time and temperature.

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |    45.0     |
| 2020-01-02 03:05:00 |    47.0     |
| 2020-01-02 03:06:00 |    48.0     |

Each field (column) of this structure can have field options applied that alter the way its values are displayed. This means that you can, for example, set the Unit to Temperature > Celsius, resulting in the following table:

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

Let's apply the field options from the [field option example]({{< relref "configure-all-fields.md#field-option-example" >}}) to apply the Celsius unit and get rid of the decimal place. This results in the following table:

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
