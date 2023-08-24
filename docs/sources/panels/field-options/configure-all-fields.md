+++
title = "Configure all fields"
keywords = ["grafana", "field options", "documentation", "format fields", "change all fields"]
type = "docs"
weight = 200
+++

# Configure all fields

To change how all fields display data, you can change an option in the Field tab. In the Overrides tab, you can then override the field options for [specific fields]({{< relref "configure-specific-fields.md" >}}).

For example, you could change the number of decimal places shown in all fields by changing the **Decimals** option. For more information about options, refer to:
   - [Standard field options]({{< relref "standard-field-options.md" >}}), apply to all visualizations that allow transformations.
   - [Table field options]({{< relref "../visualizations/table/table-field-options.md" >}}), which only apply to table panel visualizations.

## Change a field option

You can change as many options as you want to.

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
1. Click the **Field** tab.
1. Find the option you want to change. You can define:
   - [Standard field options]({{< relref "standard-field-options.md" >}}), which apply to all panel visualizations that allow transformations.
   - [Table field options]({{< relref "../visualizations/table/table-field-options.md" >}}), which only apply to table panel visualizations.
1. Add options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. When finished, click **Save** to save all panel edits to the dashboard.

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
