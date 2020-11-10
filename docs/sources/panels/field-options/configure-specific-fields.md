+++
title = "Configure specific fields"
keywords = ["grafana", "field options", "documentation", "format fields", "overrides", "override fields"]
type = "docs"
weight = 300
+++

# Configure specific fields

Overrides allow you to change the settings for one or more fields. Field options for overrides are exactly the same as the field options available in a particular visualization. The only difference is that you choose which fields to apply them to.

For example, you could change the number of decimal places shown in all numeric fields or columns by changing the **Decimals** option for **Fields with type** that matches **Numeric**. For more information about options, refer to:
   - [Standard field options]({{< relref "standard-field-options.md" >}}), which apply to all panel visualizations that allow transformations.
   - There can also be visualization specific field display options

## Add a field override

You can override as many field options as you want to.

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
1. Click the **Overrides** tab.
1. Click **Add an override for**.
1. Select which fields an override rule will be applied to:
   - **Fields with name -** Allows you to select a field from the list of all available fields. Properties you add to a rule with this selector are only applied to this single field.
   - **Fields with name matching regex -** Allows you to specify fields to override with a regular expression. Properties you add to a rule with this selector are applied to all fields where the field name match the regex.
   - **Fields with type -** Allows you to select fields by type, such as string, numeric, and so on. Properties you add to a rule with this selector are applied to all fields that match the selected type.
1. Click **Add override property**.
1. Select the field option that you want to apply.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add override** and select a different field to add overrides to.
1. When finished, click **Save** to save all panel edits to the dashboard.

## Delete a field override

1. Navigate to the Overrides tab that contains the override that you want to delete.
1. Click the trash can icon next to the override.

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
