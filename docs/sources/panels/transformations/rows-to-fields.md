+++
title = "Rows to fields"
weight = 300
+++

# Rows to fields transform

> **Note:** This is a new beta transformation introduced in v8.1. 

This transforms rows into separate fields. This can be useful as fields can be styled and configured individually, something rows cannot. It can also use additional fields as sources for dynamic field  configuration or map them to field labels. The additional labels can then be used to define better display names for the resulting fields.

Useful when visualization data in:

- Gauge
- Stat
- Pie chart

If you want to extract config from one query and appply it to another you should use the [Config from query results]({{< relref "./config-from-query.md" >}}) transformation instead.

## Example

Input:

| Name    | Value | Max |
| ------- | ----- | --- |
| ServerA | 10    | 100 |
| ServerB | 20    | 200 |
| ServerC | 30    | 300 |

Output:

| ServerA (config: max=100) | ServerB (config: max=200) | ServerC (config: max=300) |
| ------------------------- | ------------------------- | ------------------------- |
| 10                        | 20                        | 30                        |

As you can see each row in the source data becomes a separate field. Each field now also has a max config option set. Options like **Min**, **Max**, **Unit** and **Thresholds** are all part of field configuration and if set like this will be used by the visualization instead of any options manually configured in the panel editor options pane.

## Configuration

To do this transformation Grafana needs to know how to use each field in the input data. The UI options for this transform shows you all fields and **Use as** option to tell Grafana how to use the field.

### The name field (required)

This transformation needs one field to use as the source of field names. By default the transform will use the first string field for this. But you can override this default behavior by selecting **Field name** in the **Use as** column for the field you want to use instead.

### The value field (required)

This transformation needs one field to use as the source of values. By default the transform will use the first number field for this. But you can override this default behavior by selecting **Field value** in the **Use as** column for the field you want to use instead.

### Map extra fields to config

You can map extra fields to configuration like min, max, unit and threshold. If the field name maps directly
to one of these config fields Grafana will handle this mapping automatically.

### Map extra fields to labels

If a field does not map to config property Grafana will automatically use it as source for a label on the output field-

Example:

| Name    | DataCenter | Value |
| ------- | ---------- | ----- |
| ServerA | US         | 100   |
| ServerB | EU         | 200   |

Output:

| ServerA (labels: DataCenter: US) | ServerB (labels: DataCenter: EU) |
| -------------------------------- | -------------------------------- |
| 10                               | 20                               |

The extra labels can now be used in the field display name provide more complete field names. 
