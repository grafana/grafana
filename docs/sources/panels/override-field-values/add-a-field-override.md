---
aliases:
  - /docs/sources/panels/override-field-values/add-a-field-override/
title: Add a field override
weight: 30
---

# Add a field override

You can override a field when you want to change the display of the value in the visualization.

## Before you begin

- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel.md" >}}).

**To add a field override**:

1. Edit the panel to which you want to add an override.
1. In the panel display options, in the **Overrides** section, click **Add field override**.

1. Select which fields an override rule will be applied to:
   - **Fields with name -** Select a field from the list of all available fields. Properties you add to a rule with this selector are only applied to this single field.
   - **Fields with name matching regex -** Specify fields to override with a regular expression. Properties you add to a rule with this selector are applied to all fields where the field name match the regex.
   - **Fields with type -** Select fields by type, such as string, numeric, and so on. Properties you add to a rule with this selector are applied to all fields that match the selected type.
   - **Fields returned by query -** Select all fields returned by a specific query, such as A, B, or C. Properties you add to a rule with this selector are applied to all fields returned by the selected query.
1. Click **Add override property**.
1. Select the field option that you want to apply.
1. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
1. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add override** and select a different field to add overrides to.
1. When finished, click **Save** to save all panel edits to the dashboard.
