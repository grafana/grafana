+++
title = "Transform using a field mapping table"
weight = 10
+++

# Transform using a field mapping table

This transformation includes a field table which lists all fields in the data returned by the config query. This table gives you control over what field should be mapped to each config property (the \*Use as\*\* option). You can also choose which value to select if there are multiple rows in the returned data.

## Example

Input[0] (From query: A, name: ServerA)

| Time          | Value |
| ------------- | ----- |
| 1626178119127 | 10    |
| 1626178119129 | 30    |

Input[1] (From query: B)

| Time          | Value |
| ------------- | ----- |
| 1626178119127 | 100   |
| 1626178119129 | 100   |

Output (Same as Input[0] but now with config on the Value field)

| Time          | Value (config: Max=100) |
| ------------- | ----------------------- |
| 1626178119127 | 10                      |
| 1626178119129 | 30                      |

As you can see each row in the source data becomes a separate field. Each field now also has a max config option set. Options like min, max, unit and thresholds are all part of field configuration and if set like this will be used by the visualization instead of any options manually configured in the panel editor options pane.