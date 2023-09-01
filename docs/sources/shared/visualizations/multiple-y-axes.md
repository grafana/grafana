---
title: Display multiple y-axes
---

In some case, it's helpful to display multiple y-axes. This is helpful if, for example, you have multiple series representing different types of data, such as temperature and humidity. You can do this using overrides. To display multiple y-axes, follow these steps:

1. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.
1. At the bottom of the panel options pane, click **Add field override**.
1. Select the fields to which the override rule will be applied:

- **Fields with name**: Select a field from the list of all available fields. Properties you add to a rule with this selector are only applied to this single field.
- **Fields with name matching regex**: Specify fields to override with a regular expression. Properties you add to a rule with this selector are applied to all fields where the field name match the regex.
- **Fields with type**: Select fields by type, such as string, numeric, and so on. Properties you add to a rule with this selector are applied to all fields that match the selected type.
- **Fields returned by query**: Select all fields returned by a specific query, such as A, B, or C. Properties you add to a rule with this selector are applied to all fields returned by the selected query.

1. Click **Add override property**.
1. Select the field option that you want to apply.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add field override** and select a different field to add overrides to.
1. When you're finished, click **Save** to save all panel edits to the dashboard.
