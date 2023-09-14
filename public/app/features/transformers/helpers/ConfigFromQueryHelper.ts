import { getLinkToDocs } from './getLinkToDocs';

export const configFromQueryHelper = () => {
  return `
  Use this transformation to select one query and from it extract standard options such as
  **Min**, **Max**, **Unit**, and **Thresholds** and apply them to other query results.
  This enables dynamic query driven visualization configuration.

  ### Options

  - **Config query**: Selet the query that returns the data you want to use as configuration.
  - **Apply to**: Select what fields or series to apply the configuration to.
  - **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.

  ### Field mapping table

  Below the configuration listed above you will find the field table. Here all fields found in the data returned by the config query will be listed along with a **Use as** and **Select** option. This table gives you control over what field should be mapped to which config property and if there are multiple rows which value to select.

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

  Each row in the source data becomes a separate field. Each field now also has a maximum
  configuration option set. Options such as **min**, **max**, **unit**, and **thresholds** are all part of field configuration, and if they are set like this, they will be used by the visualization instead of any options that are manually configured.
  in the panel editor options pane.

  ## Value mappings

  You can also transform a query result into value mappings. This is is a bit different because every
  row in the configuration query result is used to define a single value mapping row. See the following example.

  Config query result:

  | Value | Text   | Color |
  | ----- | ------ | ----- |
  | L     | Low    | blue  |
  | M     | Medium | green |
  | H     | High   | red   |

  In the field mapping specify:

  | Field | Use as                  | Select     |
  | ----- | ----------------------- | ---------- |
  | Value | Value mappings / Value  | All values |
  | Text  | Value mappings / Text   | All values |
  | Color | Value mappings / Ciolor | All values |

  Grafana will build the value mappings from you query result and apply it the the real data query results. You should see values being mapped and colored according to the config query results.
  ${getLinkToDocs()}
  `;
};
