+++
title = "Configure specific fields"
keywords = ["grafana", "field options", "documentation", "format fields", "overrides", "override fields"]
type = "docs"
weight = 200
+++

# Configure specific fields with overrides

Overrides allow you to change the settings for one or more fields. Field options for overrides are exactly the same as the field options available in a particular visualization. The only difference is that you choose which fields to apply them to.

For example, you could change the number of decimal places shown in all numeric fields or columns by changing the **Decimals** option for **Fields with type** that matches **Numeric**. For more information about options, refer to:
   - [Standard field options]({{< relref "standard-field-options.md" >}}), apply to all visualizations that allow transformations.
   - [Table field options]({{< relref "table-options.md" >}}), which only apply to table visualizations.

## Add a field override

You can override as many field options as you want to.

1. Navigate to the panel you want to edit, click the panel title, and then click **Edit**.
1. Click the **Overrides** tab.
1. Click **Add an override for**.
1. Select which fields an override rule will be applied to:
   - **Fields with name -** Allows you to select a field from the list of all available fields. Properties you add to a rule with this selector are only applied to this single field.
   - **Fields with name matching regex -** Allows you to specify fields to override with a regular expression. Properties you add to a rule with this selector are applied to all fields where the field name match the regex.
   - **Fields with type -** Allows you to select fields by type, such as string, numeric, and so on. Properties you add to a rule with this selector are applied to all fields that match the selected type.
2. Click **Add override property**.
3. Select the field option that you want to apply.
4. Enter options by adding values in the fields. To return options to default values, delete the white text in the fields.
5. Continue to add overrides to this field by clicking **Add override property**, or you can click **Add override** and select a different field to add overrides to.
6. When finished, click **Save** to save all panel edits to the dashboard.


## Delete a field override

1. Navigate to the Overrides tab that contains the override that you want to delete.
1. Click the trash can icon next to the override.