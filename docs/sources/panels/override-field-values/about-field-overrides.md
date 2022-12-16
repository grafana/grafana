---
aliases:
  - /docs/sources/panels/override-field-values/about-field-overrides/
title: About field overrides
weight: 10
---

# About field overrides

Overrides allow you to change the settings for one or more fields. Field options for overrides are the same as the field options available in a particular visualization. The only difference is that you choose which fields to apply them to.

For example, you could change the number of decimal places shown in all numeric fields or columns by changing the **Decimals** option for **Fields with type** that matches **Numeric**.

## Example 1: Format temperature

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

In addition, the decimal place is not required, so we can remove it. You can change the Decimals from `auto` to zero (`0`), resulting in the following table:

|        time         | temperature |
| :-----------------: | :---------: |
| 2020-01-02 03:04:00 |    45 °C    |
| 2020-01-02 03:05:00 |    47 °C    |
| 2020-01-02 03:06:00 |    48 °C    |

## Example 2: Format temperature and humidity

Let’s assume that our result set is a data frame that consists of four fields: time, high temp, low temp, and humidity.

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45.0      | 30.0     | 67       |
| 2020-01-02 03:05:00 | 47.0      | 34.0     | 68       |
| 2020-01-02 03:06:00 | 48.0      | 31.0     | 68       |

Let's add the Celsius unit and get rid of the decimal place. This results in the following table:

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45 °C     | 30 °C    | 67 °C    |
| 2020-01-02 03:05:00 | 47 °C     | 34 °C    | 68 °C    |
| 2020-01-02 03:06:00 | 48 °C     | 31 °C    | 68 °C    |

The temperature fields look good, but the humidity must now be changed. We can fix this by applying a field option override to the humidity field and change the unit to Misc > percent (0-100).

| time                | high temp | low temp | humidity |
| ------------------- | --------- | -------- | -------- |
| 2020-01-02 03:04:00 | 45 °C     | 30 °C    | 67%      |
| 2020-01-02 03:05:00 | 47 °C     | 34 °C    | 68%      |
| 2020-01-02 03:06:00 | 48 °C     | 31 °C    | 68%      |
