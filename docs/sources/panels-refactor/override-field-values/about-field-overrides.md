+++
title = "About field overrides"
weight = 1
+++

# About field overrides

Overrides allow you to change the settings for one or more fields. Field options for overrides are exactly the same as the field options available in a particular visualization. The only difference is that you choose which fields to apply them to.

For example, you could change the number of decimal places shown in all numeric fields or columns by changing the **Decimals** option for **Fields with type** that matches **Numeric**.


Another source input...

## Example use case for field options and overrides

The following examples show how you might use field options and overrides.


++++++++++++++++++++++++++++++++++++++++++++++++++
Where does this go?
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

+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

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


## Field overrides

_Field overrides_ can be added or viewed in the Overrides tab in the panel editor side menu. You can apply options to specific fields (series or columns) rather than all fields. Learn how to apply an override in [Field overrides]({{< relref "./field-overrides.md" >}}).

Options are documented in the following topics:

- [Add a panel]({{< relref "./add-a-panel.md" >}}) describes how to add a panel to a dashboard.
- [Panel options]({{< relref "./panel-options.md" >}})
- [Visualization options]({{< relref "../visualizations/_index.md" >}}) vary widely. They are described in the individual visualization topic.
- [Standard options]({{< relref "./standard-options.md" >}})
- [Thresholds]({{< relref "./thresholds.md" >}})
- [Value mappings]({{< relref "./value-mappings.md" >}})
- [Panel links]({{< relref "../linking/panel-links.md" >}}) and [Data links]({{< relref "../linking/data-links.md" >}}) help you connect your visualization to other resources.
- [Overrides]({{< relref "./field-overrides.md" >}})