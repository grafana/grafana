export const rowsToFieldsHelper = () => {
  return `
  Use this transformation to convert rows into separate fields. This can be useful as fields can be styled and configured individually. It can also use additional fields as sources for dynamic field configuration or map them to field labels. The additional labels can then be used to define better display names for the resulting fields.

  This transformation includes a field table which lists all fields in the data returned by the config query. This table gives you control over what field should be mapped to each config property (the \*Use as\*\* option). You can also choose which value to select if there are multiple rows in the returned data.

  This transformation requires:

  - One field to use as the source of field names.

    By default, the transform uses the first string field as the source. You can override this default setting by selecting **Field name** in the **Use as** column for the field you want to use instead.

  - One field to use as the source of values.

    By default, the transform uses the first number field as the source. But you can override this default setting by selecting **Field value** in the **Use as** column for the field you want to use instead.

  Useful when visualizing data in:

  - Gauge
  - Stat
  - Pie chart

  #### Map extra fields to labels

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

  If you want to extract config from one query and appply it to another you should use the config from query results transformation.

  #### Example

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
  `;
};
