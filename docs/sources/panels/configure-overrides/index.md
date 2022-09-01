---
aliases:
  - /docs/grafana/latest/panels/field-overrides/
  - /docs/grafana/latest/panels/override-field-values/
  - /docs/grafana/latest/panels/override-field-values/about-field-overrides/
  - /docs/grafana/latest/panels/override-field-values/add-a-field-override/
  - /docs/grafana/latest/panels/override-field-values/delete-a-field-override/
  - /docs/grafana/latest/panels/override-field-values/edit-field-override/
  - /docs/grafana/latest/panels/override-field-values/view-field-override/
title: Configure field overrides
menuTitle: Configure field overrides
weight: 400
---

# Configure field overrides

Overrides allow you to customize visualization settings for specific fields or series. This is accomplished by adding an override rule that targets a particular set of fields and that can each define multiple options.

For example, you set the unit for all fields that include the text 'bytes' by adding an override using the `Fields with name matching regex` matcher and then add the Unit option to the override rule.

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

## Add a field override

A field override rule can customize the visualization settings for a specific field or series.

1. Edit the panel to which you want to add an override.
1. In the panel options side pane, click **Add field override** at the bottom of the pane.

1. Select which fields an override rule will be applied to:
   - **Fields with name:** Select a field from the list of all available fields. Properties you add to a rule with this selector are only applied to this single field.
   - **Fields with name matching regex:** Specify fields to override with a regular expression. Properties you add to a rule with this selector are applied to all fields where the field name match the regex.
   - **Fields with type:** Select fields by type, such as string, numeric, and so on. Properties you add to a rule with this selector are applied to all fields that match the selected type.
   - **Fields returned by query:** Select all fields returned by a specific query, such as A, B, or C. Properties you add to a rule with this selector are applied to all fields returned by the selected query.
1. Click **Add override property**.
1. Select the field option that you want to apply.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add override** and select a different field to add overrides to.
1. When finished, click **Save** to save all panel edits to the dashboard.

## Delete a field override

Delete a field override when you no longer need it. When you delete an override, the appearance of value defaults to its original format. This change impacts dashboards and dashboard users that rely on an affected panel.

1. Edit the panel that contains the override you want to delete.
1. In panel options side pane, scroll down until you see the overrides.
1. Click the override you want to delete and then click the associated trash icon.

## View field overrides

You can view field overrides in the panel display options.

1. Edit the panel that contains the overrides you want to view.
1. In panel options side pane, scroll down until you see the overrides.

> The override settings that appear on the **All** tab are the same as the settings that appear on the **Overrides** tab.

## Edit a field override

Edit a field override when you want to make changes to an override setting. The change you make takes effect immediately.

1. Edit the panel that contains the overrides you want to edit.
1. In panel options side pane, scroll down until you see the overrides.
1. Locate the override that you want to change.
1. Perform any of the following:
   - Edit settings on existing overrides or field selection parameters.
   - Delete existing override properties by clicking the **X** next to the property.
   - Add an override properties by clicking **Add override property**.
