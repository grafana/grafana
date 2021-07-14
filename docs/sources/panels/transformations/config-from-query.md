+++
title = "Config from query results"
weight = 300
+++

# Config from query results transform

> **Note:** This is a new beta transformation introduced in v8.1. 

This transformation allow you select one query and from it extract [standard options]({{< relref "./standard-options.md" >}}) like **Min**, **Max**, **Unit** and **Thresholds** and apply it to other query results. This enables dynamic query driven visualization configuration.

If you want to extract a unique config for every row in the config query result then try the [Rows to fields]({{< relref "./rows-to-fields" >}}) transformation instead.

### Options

- **Config query**: Selet the query that returns the data you want to use as configuration.
- **Apply to**: Select what fields or series to apply the configuration to.
- **Apply to options**: Usually a field type or field name regex depending on what option you selected in **Apply to**.

### Field mapping table

This transformation includes a field table which lists all fields in the data returned by the config query. This table gives you control over what field should be mapped to each config property (the *Use as** option). You can also choose which value to select if there are multiple rows in the returned data. 

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

## Value mappings

You can also transform a query result into value mappings. This is is a bit different as here every row in the config query result will be used to define a single value mapping row. See example below. 

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