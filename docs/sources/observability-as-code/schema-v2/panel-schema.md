---
description: A reference for the JSON panel schema used with Observability as Code.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
  - panels
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: PanelKind schema
title: PanelKind
weight: 200
---

# `PanelKind`

The panel element contains all the information about the panel including the visualization type, panel and visualization configuration, queries, and transformations.
There's a panel element for each panel contained in the dashboard.

Following is the default panel element JSON:

```json
      "kind": "Panel",
      "spec": {
        "data": {
          "kind": "QueryGroup",
          "spec": {...},
        "description": "",
        "id": 0,
        "links": [],
        "title": "",
        "vizConfig": {
          "kind": "",
          "spec": {...},
        }
      }
```

The `PanelKind` consists of:

- kind: "Panel"
- spec: [PanelSpec](#panelspec)

## `PanelSpec`

The following table explains the usage of the panel element JSON fields:

<!-- prettier-ignore-start -->

| Name         | Usage                                                                 |
| ------------ | --------------------------------------------------------------------- |
| data         | `QueryGroupKind`, which includes queries and transformations. Consists of:<ul><li>kind: "QueryGroup"</li><li>spec: [QueryGroupSpec](#querygroupspec)</li></ul>                               |
| description  | The panel description.                                                |
| id           | The panel ID.                                                         |
| links        | Links with references to other dashboards or external websites.       |
| title        | The panel title.                                                      |
| vizConfig    | `VizConfigKind`. Includes visualization type, field configuration options, and all other visualization options. Consists of:<ul><li>kind: string. Plugin ID.</li><li>spec: [VizConfigSpec](#vizconfigspec)</li></ul>                            |
| transparent? | bool. Controls whether or not the panel background is transparent. |

<!-- prettier-ignore-end -->

### `QueryGroupSpec`

<!-- prettier-ignore-start -->

| Name            | Usage                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| queries         | `PanelQueryKind`. Consists of:<ul><li>kind: PanelQuery</li><li>spec: [PanelQuerySpec](#panelqueryspec)</li></ul>                                       |
| transformations | `TransformationKind`. Consists of:<ul><li>kind: string. The transformation ID.</li><li>spec: [DataTransformerConfig](#datatransformerconfig)</li></ul> |
| queryOptions    | [`QueryOptionsSpec`](#queryoptionsspec)                                                                                                                |

<!-- prettier-ignore-end -->

#### `PanelQuerySpec`

| Name        | Usage                             |
| ----------- | --------------------------------- |
| query       | [`DataQueryKind`](#dataquerykind) |
| datasource? | [`DataSourceRef`](#datasourceref) |

##### `DataQueryKind`

| Name | Type   |
| ---- | ------ |
| kind | string |
| spec | string |

##### `DataSourceRef`

| Name  | Usage                              |
| ----- | ---------------------------------- |
| type? | string. The plugin type-id.        |
| uid?  | The specific data source instance. |

#### `DataTransformerConfig`

Transformations allow you to manipulate data returned by a query before the system applies a visualization.
Using transformations you can: rename fields, join time series data, perform mathematical operations across queries, or use the output of one transformation as the input to another transformation.

<!-- prettier-ignore-start -->

| Name      | Usage                                     |
| --------- | ------------------------------------------- |
| id        | string. Unique identifier of transformer.   |
| disabled? | bool. Disabled transformations are skipped. |
| filter?   | [`MatcherConfig`](#matcherconfig). Optional frame matcher. When missing it will be applied to all results.  |
| topic?    | `DataTopic`. Where to pull `DataFrames` from as input to transformation. Options are: `series`, `annotations`, and `alertStates`. |
| options   | Options to be passed to the transformer. Valid options depend on the transformer id.  |

<!-- prettier-ignore-end -->

##### `MatcherConfig`

Matcher is a predicate configuration.
Based on the configuration a set of field or values, it's filtered to apply an override or transformation.
It comes with in id (to resolve implementation from registry) and a configuration that’s specific to a particular matcher type.

| Name     | Usage                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| id       | string. The matcher id. This is used to find the matcher implementation from registry. |
| options? | The matcher options. This is specific to the matcher implementation.                   |

#### `QueryOptionsSpec`

| Name              | Type    |
| ----------------- | ------- |
| timeFrom?         | string  |
| maxDataPoints?    | integer |
| timeShift?        | string  |
| queryCachingTTL?  | integer |
| interval?         | string  |
| cacheTimeout?     | string  |
| hideTimeOverride? | bool    |

### `VizConfigSpec`

| Name          | Type/Definition                         |
| ------------- | --------------------------------------- |
| pluginVersion | string                                  |
| options       | string                                  |
| fieldConfig   | [FieldConfigSource](#fieldconfigsource) |

#### `FieldConfigSource`

The data model used in Grafana, namely the _data frame_, is a columnar-oriented table structure that unifies both time series and table query results.
Each column within this structure is called a field.
A field can represent a single time series or table column.
Field options allow you to change how the data is displayed in your visualizations.

<!-- prettier-ignore-start -->

| Name       | Type/Definition                   |
| ---------- | ------------------------------------- |
| defaults   | [`FieldConfig`](#fieldconfig). Defaults are the options applied to all fields.  |
| overrides  |  The options applied to specific fields overriding the defaults.  |
| matcher    | [`MatcherConfig`](#matcherconfig). Optional frame matcher. When missing it will be applied to all results.  |
| properties | `DynamicConfigValue`. Consists of:<ul><li>`id` - string</li><li>value?</li></ul> |

<!-- prettier-ignore-end -->

##### `FieldConfig`

<!-- prettier-ignore-start -->

| Name               | Type/Definition                  |
| ------------------ | --------------------------------------- |
| displayName?       | string. The display value for this field. This supports template variables where empty is auto.  |
| displayNameFromDS? | string. This can be used by data sources that return an explicit naming structure for values and labels. When this property is configured, this value is used rather than the default naming strategy.  |
| description?       | string. Human readable field metadata.  |
|  path?             | string. An explicit path to the field in the data source. When the frame meta includes a path, this will default to `${frame.meta.path}/${field.name}`. When defined, this value can be used as an identifier within the data source scope, and may be used to update the results.                                      |
| writeable?         | bool. True if the data source can write a value to the path. Auth/authz are supported separately. |
| filterable?        | bool. True if the data source field supports ad-hoc filters. |
| unit?              | string. Unit a field should use. The unit you select is applied to all fields except time. You can use the unit's ID available in Grafana or a custom unit. [Available units in Grafana](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts). As custom units, you can use the following formats:<ul><li>`suffix:<suffix>` for custom unit that should go after value.</li><li>`prefix:<prefix>` for custom unit that should go before value.</li><li> `time:<format>` for custom date time formats type for example</li><li>`time:YYYY-MM-DD`</li><li>`si:<base scale><unit characters>` for custom SI units. For example: `si: mF`. You can specify both a unit and the source data scale, so if your source data is represented as milli (thousands of) something, prefix the unit with that SI scale character.</li><li>`count:<unit>` for a custom count unit.</li><li>`currency:<unit>` for custom a currency unit.</li></ul>                                         |
| decimals?          | number. Specify the number of decimals Grafana includes in the rendered value. If you leave this field blank, Grafana automatically truncates the number of decimals based on the value. For example 1.1234 will display as 1.12 and 100.456 will display as 100. To display all decimals, set the unit to `string`. |
| min?               | number. The minimum value used in percentage threshold calculations. Leave empty for auto calculation based on all series and fields.       |
| max?               | number. The maximum value used in percentage threshold calculations. Leave empty for auto calculation based on all series and fields.       |
| mappings?          | `[...ValueMapping]`. Convert input values into a display string. Options are: [`ValueMap`](#valuemap), [`RangeMap`](#rangemap), [`RegexMap`](#rangemap), [`SpecialValueMap`](#specialvaluemap).         |
| thresholds?        | `ThresholdsConfig`. Map numeric values to states. Consists of:<ul><li>`mode` - `ThresholdsMode`. Options are: `absolute` and `percentage`.</li><li>`steps` - `[...Threshold]`</li></ul>    |
| color?             | [`FieldColor`](#fieldcolor). Panel color configuration.  |
| links?             | `[...]`. The behavior when clicking a result.  |
| noValue?           | string. Alternative to an empty string.    |
| custom?            | `{...}`. Specified by the `FieldConfig` field in panel plugin schemas.   |

<!-- prettier-ignore-end -->

###### `ValueMap`

Maps text values to a color or different display text and color.
For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.

<!-- prettier-ignore-start -->

| Name    | Usage                             |
| ------- | -------- |
| type    | `MappingType` & "value". `MappingType` options are: `value`, `range`, `regex`, and `special`.    |
| options | string. [`ValueMappingResult`](#valuemappingresult). Map with `<value_to_match>`: `ValueMappingResult`. For example: `{ "10": { text: "Perfection!", color: "green" } }`.   |

<!-- prettier-ignore-end -->

###### `RangeMap`

Maps numerical ranges to a display text and color.
For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.

<!-- prettier-ignore-start -->

| Name    | Usage                                                              |
| ------- | ---------------------------------------------------------------------------------------------------- |
| type    | `MappingType` & "range". `MappingType` options are: `value`, `range`, `regex`, and `special`.                                                                  |
| options | Range to match against and the result to apply when the value is within the range. Spec:<ul><li>`from` - `float64` or `null`. Min value of the range. It can be null which means `-Infinity`.</li><li>`to` - `float64` or `null`. Max value of the range. It can be null which means `+Infinity`.</li><li>`result` - [`ValueMappingResult`](#valuemappingresult) |

<!-- prettier-ignore-end -->

###### `RegexMap`

Maps regular expressions to replacement text and a color.
For example, if a value is `www.example.com`, you can configure a regex value mapping so that Grafana displays www and truncates the domain.

<!-- prettier-ignore-start -->

| Name    | Usage                                                                                         |
| ------- | --------------------------------------------------------------------------------------------- |
| type    | `MappingType` & "regex". `MappingType` options are: `value`, `range`, `regex`, and `special`. |
| options | Regular expression to match against and the result to apply when the value matches the regex. Spec:<ul><li>`pattern` - string. Regular expression to match against.</li><li>`result` - [`ValueMappingResult`](#valuemappingresult)                                                         |

<!-- prettier-ignore-end -->

###### `SpecialValueMap`

Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color.
See `SpecialValueMatch` in the following table to see the list of special values.
For example, you can configure a special value mapping so that null values appear as N/A.

<!-- prettier-ignore-start -->

| Name    | Usage                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------- |
| type    | `MappingType` & "special". `MappingType` options are: `value`, `range`, `regex`, and `special`. |
| options | Spec:<ul><li>`match` - `SpecialValueMatch`. Special value to match against. Types are:<ul><li>true</li><li>false</li><li>null</li><li>nan</li><li>empty</li></ul> </li><li>`result` - [`ValueMappingResult`](#valuemappingresult)   |

<!-- prettier-ignore-end -->

###### `ValueMappingResult`

Result used as replacement with text and color when the value matches.

| Name  | Usage                                                                         |
| ----- | ----------------------------------------------------------------------------- |
| text  | string. Text to display when the value matches.                               |
| color | string. Color to use when the value matches.                                  |
| icon  | string. Icon to display when the value matches. Only specific visualizations. |
| index | int32. Position in the mapping array. Only used internally.                   |

###### `FieldColor`

Map a field to a color.

<!-- prettier-ignore-start -->

| Name        | Usage                                                                |
| ----------- | -------------------------------------------------------------------- |
| mode        | [`FieldColorModeId`](#fieldcolormodeid). The main color scheme mode. |
| FixedColor? | string. The fixed color value for fixed or shades color modes.       |
| seriesBy?   |  `FieldColorSeriesByMode`. Some visualizations need to know how to assign a series color from by value color schemes. Defines how to assign a series color from "by value" color schemes. For example for an aggregated data points like a timeseries, the color can be assigned by the min, max or last value. Options are: `min`, `max`, and `last`. |

<!-- prettier-ignore-end -->

###### `FieldColorModeId`

Color mode for a field.
You can specify a single color, or select a continuous (gradient) color schemes, based on a value.
Continuous color interpolates a color using the percentage of a value relative to min and max.
Accepted values are:

<!-- prettier-ignore-start -->

| Name | Description |
| --- | ---- |
| thresholds | From thresholds. Informs Grafana to take the color from the matching threshold. |
| palette-classic | Classic palette. Grafana will assign color by looking up a color in a palette by series index. Useful for graphs and pie charts and other categorical data visualizations. |
| palette-classic-by-name | Classic palette (by name). Grafana will assign color by looking up a color in a palette by series name. Useful for Graphs and pie charts and other categorical data visualizations |
| continuous-GrYlRd | Continuous Green-Yellow-Red palette mode |
| continuous-RdYlGr | Continuous Red-Yellow-Green palette mode |
| continuous-BlYlRd | Continuous Blue-Yellow-Red palette mode |
| continuous-YlRd | Continuous Yellow-Red palette mode |
| continuous-BlPu | Continuous Blue-Purple palette mode |
| continuous-YlBl | Continuous Yellow-Blue palette mode |
| continuous-blues | Continuous Blue palette mode |
| continuous-reds | Continuous Red palette mode |
| continuous-greens | Continuous Green palette mode |
| continuous-purples | Continuous Purple palette mode |
| shades | Shades of a single color. Specify a single color, useful in an override rule. |
| fixed | Fixed color mode. Specify a single color, useful in an override rule. |

<!-- prettier-ignore-end -->
