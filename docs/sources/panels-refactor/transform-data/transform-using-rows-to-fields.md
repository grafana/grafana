+++
title = "Transform using rows to fields"
weight = 10
+++

# Transform using rows to fields

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