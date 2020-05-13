+++
title = "Field configuration"
type = "docs"
[menu.docs]
parent = "panels"
weight = 300
+++

# Field configuration

This page explains what field configurations and field overrides in Grafana are and how to use them. It also includes [examples](#examples) if you need an idea of how this feature might be useful in the real world.

> **Note:** This documentation refers to a Grafana 7.0 beta feature. This documentation will be frequently updated to reflect updates to the feature, and it will probably be broken into smaller sections when the feature moves out of beta.

## What is a field?

The data model behind Grafana, the [data frame]({{< relref "../developers/plugins/data-frames.md" >}}), is a columnar-oriented table structure. 

Each column within this structure is called a _field_. Grafana allows to customize how a particular field is displayed in the visualization. This customization is available in Field options in the panel editor.

## Field configuration options and overrides

Field configuration options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data.

> **Note:** The time fields are not affected by field configuration options or overrides.

_Field configuration options_, both standard and custom, are applied in the **Field** tab. Changes on this panel apply to all fields in the visualization. For example, if you change the unit to percentage, then all fields with numeric values will be calculated in percentages. [Apply a field option](#configure-all-fields).

_Field overrides_ are applied in the _Overrides_ tab. They are exactly the same as field configuration options except that they only change fields you select. The current feature only allows you to change one field at a time, but future improvements will offer more flexibility. [Apply an override](#override-a-field).

All [field options](#field-options) are defined below.

### Standard field options

Standard field options are:

- Unit
- Min
- Max
- Decimals
- Display name
- No value
- Thresholds
- Value mappings
- Data links

You can apply standard field options to the following panel visualizations:

- Bar gauge
- Gauge
- Stat
- Table

### Custom field options

You can only apply custom field options to table visualizations.

Custom field options are:

- Column width
- Column alignment
- Cell display mode 

## Configure all fields

To change how all fields display data, you apply a [field option](#field-options). Usually you apply changes that you want to most or all of the fields here, than apply field overrides to exceptions.

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
2. Click the **Field** tab.
3. Find the 
4. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
5. When finished, click **Save** to save all panel edits to the dashboard.

## Override a field

Field overrides allow you to change the settings for one field (column in tables) to be different than the others. Field options for overrides are exactly the same as the field options available in a particular visualization. The only difference is that you choose which field to apply them to. 

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
1. Click the **Overrides** tab.
1. Click **Add override**.
1. Select a filter option to choose which fields the override applies to. 
   
   **Note:** Currently you can only match by name, so after you choose the filter, select which field it applies to in the dropdown list.

1. Click **Add override property**.
1. Select the [field option](#field-options) you want to apply.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add override** and select a different field to add overrides to.
1. When finished, click **Save** to save all panel edits to the dashboard.

## Field options

This section explains all available field options. They are listed in alphabetical order.

### Cell display mode
### Column alignment
### Column width
### Decimals
### Data links
### Display name
### Max
### Min
### No value
### Thresholds
### Value mapping

## Examples

Here are some examples of how you might use this feature.

## Field option example

Let’s assume that our result set is a data frame that consists of two fields: time and temperature.

| time | temperature |
|:--:|:--:|
| 2020-01-02 03:04:00 | 45.0 |
| 2020-01-02 03:05:00 | 47.0 |
| 2020-01-02 03:06:00 | 48.0 |

Each field(column) of this structure can have field options applied that alter the way its values are displayed. This means that you can, for example, set the Unit to Temperature > Celsius, resulting in the following table:

| time | temperature |
|:--:|:--:|
| 2020-01-02 03:04:00 | 45.0 °C |
| 2020-01-02 03:05:00 | 47.0 °C |
| 2020-01-02 03:06:00 | 48.0 °C |

While we're at it, the decimal place doesn't add anything to this display. You can change the Decimals from `auto` to zero (`0`), resulting in the following table:

| time | temperature |
|:--:|:--:|
| 2020-01-02 03:04:00 | 45 °C |
| 2020-01-02 03:05:00 | 47 °C |
| 2020-01-02 03:06:00 | 48 °C |

## Field override example

Let’s assume that our result set is a data frame that consists of four fields: time, high temp, low temp, and humidity.

| time                | high temp | low temp | humidity |
|---------------------|-----------|----------|----------|
| 2020-01-02 03:04:00 | 45.0      | 30.0     | 67       |
| 2020-01-02 03:05:00 | 47.0      | 34.0     | 68       |
| 2020-01-02 03:06:00 | 48.0      | 31.0     | 68       |

Let's apply the field options from the [field option example](#field-option-example) to apply the Celsius unit and get rid of the decimal place. This results in the following table:

| time                | high temp | low temp | humidity |
|---------------------|-----------|----------|----------|
| 2020-01-02 03:04:00 | 45 °C  | 30 °C  | 67 °C    |
| 2020-01-02 03:05:00 | 47 °C  | 34 °C  | 68 °C    |
| 2020-01-02 03:06:00 | 48 °C  | 31 °C  | 68 °C    |

The temperature fields look good, but the humidity is nonsensical. We can fix this by applying a field option override to the humidity field and change the unit to Misc > percent (0-100). This results in a table that makes a lot more sense:

| time                | high temp | low temp | humidity |
|---------------------|-----------|----------|----------|
| 2020-01-02 03:04:00 | 45 °C  | 30 °C  | 67%    |
| 2020-01-02 03:05:00 | 47 °C  | 34 °C  | 68%    |
| 2020-01-02 03:06:00 | 48 °C  | 31 °C  | 68%    |
