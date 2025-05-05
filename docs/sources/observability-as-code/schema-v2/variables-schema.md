---
description: A reference for the JSON variables schema used with Observability as Code.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
  - variables
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: variables schema
title: variables
weight: 700
---

# `variables`

The available variable types described in the following sections:

- [QueryVariableKind](#queryvariablekind)
- [TextVariableKind](#textvariablekind)
- [ConstantVariableKind](#constantvariablekind)
- [DatasourceVariableKind](#datasourcevariablekind)
- [IntervalVariableKind](#intervalvariablekind)
- [CustomVariableKind](#customvariablekind)
- [GroupByVariableKind](#groupbyvariablekind)
- [AdhocVariableKind](#adhocvariablekind)

## `QueryVariableKind`

Following is the JSON for a default query variable:

```json
  "variables": [
    {
      "kind": "QueryVariable",
      "spec": {
        "current": {
          "text": "",
          "value": ""
        },
        "hide": "dontHide",
        "includeAll": false,
        "multi": false,
        "name": "",
        "options": [],
        "query": defaultDataQueryKind(),
        "refresh": "never",
        "regex": "",
        "skipUrlSync": false,
        "sort": "disabled"
      }
    }
  ]
```

`QueryVariableKind` consists of:

- kind: "QueryVariable"
- spec: [QueryVariableSpec](#queryvariablespec)

### `QueryVariableSpec`

The following table explains the usage of the query variable JSON fields:

<!-- prettier-ignore-start -->

| Name         | Usage                                                  |
| ------------ | ---------------------------------------------- |
| name         | string. Name of the variable. |
| current      | "Text" and a "value" or [`VariableOption`](#variableoption) |
| label?       | string |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`. |
| refresh      | `VariableRefresh`. Options are `never`, `onDashboardLoad`, and `onTimeChanged`. |
| skipUrlSync  | bool. Default is `false`. |
| description? | string |
| datasource?  | [`DataSourceRef`](#datasourceref) |
| query        | `DataQueryKind`. Consists of:<ul><li>kind: string</li><li>spec: string</li></ul> |
| regex        | string |
| sort         | `VariableSort`. Options are:<ul><li>disabled</li><li>alphabeticalAsc</li><li>alphabeticalDesc</li><li>numericalAsc</li><li>numericalDesc</li><li>alphabeticalCaseInsensitiveAsc</li><li>alphabeticalCaseInsensitiveDesc</li><li>naturalAsc</li><li>naturalDesc</li></ul> |
| definition?  | string |
| options      | [`VariableOption`](#variableoption)  |
| multi        | bool. Default is `false`.  |
| includeAll   | bool. Default is `false`. |
| allValue?    | string |
| placeholder? | string |

<!-- prettier-ignore-end -->

#### `VariableOption`

| Name     | Usage                                        |
| -------- | -------------------------------------------- |
| selected | bool. Whether or not the option is selected. |
| text     | string. Text to be displayed for the option. |
| value    | string. Value of the option.                 |

#### `DataSourceRef`

| Name  | Usage                              |
| ----- | ---------------------------------- |
| type? | string. The plugin type-id.        |
| uid?  | The specific data source instance. |

## `TextVariableKind`

Following is the JSON for a default text variable:

```json
  "variables": [
    {
      "kind": "TextVariable",
      "spec": {
        "current": {
          "text": "",
          "value": ""
        },
        "hide": "dontHide",
        "name": "",
        "query": "",
        "skipUrlSync": false
      }
    }
  ]
```

`TextVariableKind` consists of:

- kind: TextVariableKind
- spec: [TextVariableSpec](#textvariablespec)

### `TextVariableSpec`

The following table explains the usage of the query variable JSON fields:

| Name         | Usage                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable.                                                                                                    |
| current      | "Text" and a "value" or `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`. |
| query        | string                                                                                                                           |
| label?       | string                                                                                                                           |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                        |
| skipUrlSync  | bool. Default is `false`.                                                                                                        |
| description? | string                                                                                                                           |

## `ConstantVariableKind`

Following is the JSON for a default constant variable:

```json
  "variables": [
    {
      "kind": "ConstantVariable",
      "spec": {
        "current": {
          "text": "",
          "value": ""
        },
        "hide": "hideVariable",
        "name": "",
        "query": "",
        "skipUrlSync": true
      }
    }
  ]
```

`ConstantVariableKind` consists of:

- kind: "ConstantVariable"
- spec: [ConstantVariableSpec](#constantvariablespec)

### `ConstantVariableSpec`

The following table explains the usage of the constant variable JSON fields:

| Name         | Usage                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable.                                                                                                    |
| query        | string                                                                                                                           |
| current      | "Text" and a "value" or `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`. |
| label?       | string                                                                                                                           |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                        |
| skipUrlSync  | bool. Default is `false`.                                                                                                        |
| description? | string                                                                                                                           |

## `DatasourceVariableKind`

Following is the JSON for a default data source variable:

```json
  "variables": [
    {
      "kind": "DatasourceVariable",
      "spec": {
        "current": {
          "text": "",
          "value": ""
        },
        "hide": "dontHide",
        "includeAll": false,
        "multi": false,
        "name": "",
        "options": [],
        "pluginId": "",
        "refresh": "never",
        "regex": "",
        "skipUrlSync": false
      }
    }
  ]
```

`DatasourceVariableKind` consists of:

- kind: "DatasourceVariable"
- spec: [DatasourceVariableSpec](#datasourcevariablespec)

### `DatasourceVariableSpec`

The following table explains the usage of the data source variable JSON fields:

| Name         | Usage                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable.                                                                                                    |
| pluginId     | string                                                                                                                           |
| refresh      | `VariableRefresh`. Options are `never`, `onDashboardLoad`, and `onTimeChanged`.                                                  |
| regex        | string                                                                                                                           |
| current      | `Text` and a `value` or `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`. |
| options      | `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`.                         |
| multi        | bool. Default is `false`.                                                                                                        |
| includeAll   | bool. Default is `false`.                                                                                                        |
| allValue?    | string                                                                                                                           |
| label?       | string                                                                                                                           |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                        |
| skipUrlSync  | bool. Default is `false`.                                                                                                        |
| description? | string                                                                                                                           |

## `IntervalVariableKind`

Following is the JSON for a default interval variable:

```json
  "variables": [
    {
      "kind": "IntervalVariable",
      "spec": {
        "auto": false,
        "auto_count": 0,
        "auto_min": "",
        "current": {
          "text": "",
          "value": ""
        },
        "hide": "dontHide",
        "name": "",
        "options": [],
        "query": "",
        "refresh": "never",
        "skipUrlSync": false
      }
    }
  ]
```

`IntervalVariableKind` consists of:

- kind: "IntervalVariable"
- spec: [IntervalVariableSpec](#intervalvariablespec)

### `IntervalVariableSpec`

The following table explains the usage of the interval variable JSON fields:

| Name         | Usage                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable.                                                                                                    |
| query        | string                                                                                                                           |
| current      | `Text` and a `value` or `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`. |
| options      | `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`.                         |
| auto         | bool. Default is `false`.                                                                                                        |
| auto_count   | integer. Default is `0`.                                                                                                         |
| refresh      | `VariableRefresh`. Options are `never`, `onDashboardLoad`, and `onTimeChanged`.                                                  |
| label?       | string                                                                                                                           |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                        |
| skipUrlSync  | bool. Default is `false`                                                                                                         |
| description? | string                                                                                                                           |

## `CustomVariableKind`

Following is the JSON for a default custom variable:

```json
  "variables": [
    {
      "kind": "CustomVariable",
      "spec": {
        "current": defaultVariableOption(),
        "hide": "dontHide",
        "includeAll": false,
        "multi": false,
        "name": "",
        "options": [],
        "query": "",
        "skipUrlSync": false
      }
    }
  ]
```

`CustomVariableKind` consists of:

- kind: "CustomVariable"
- spec: [CustomVariableSpec](#customvariablespec)

### `CustomVariableSpec`

The following table explains the usage of the custom variable JSON fields:

| Name         | Usage                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable.                                                                                                    |
| query        | string                                                                                                                           |
| current      | `Text` and a `value` or `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`. |
| options      | `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`.                         |
| multi        | bool. Default is `false`.                                                                                                        |
| includeAll   | bool. Default is `false`.                                                                                                        |
| allValue?    | string                                                                                                                           |
| label?       | string                                                                                                                           |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                        |
| skipUrlSync  | bool. Default is `false`.                                                                                                        |
| description? | string                                                                                                                           |

## `GroupByVariableKind`

Following is the JSON for a default group by variable:

```json
  "variables": [
    {
      "kind": "GroupByVariable",
      "spec": {
        "current": {
          "text": [
            ""
          ],
          "value": [
            ""
          ]
        },
        "datasource": {},
        "hide": "dontHide",
        "multi": false,
        "name": "",
        "options": [],
        "skipUrlSync": false
      }
    }
  ]
```

`GroupByVariableKind` consists of:

- kind: "GroupByVariable"
- spec: [GroupByVariableSpec](#groupbyvariablespec)

### `GroupByVariableSpec`

The following table explains the usage of the group by variable JSON fields:

| Name         | Usage                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable                                                                                                     |
| datasource?  | `DataSourceRef`. Refer to the [`DataSourceRef` definition](#datasourceref) under `QueryVariableKind`.                            |
| current      | `Text` and a `value` or `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`. |
| options      | `VariableOption`. Refer to the [`VariableOption` definition](#variableoption) under `QueryVariableKind`.                         |
| multi        | bool. Default is `false`.                                                                                                        |
| label?       | string                                                                                                                           |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                        |
| skipUrlSync  | bool. Default is `false`.                                                                                                        |
| description? | string.                                                                                                                          |

## `AdhocVariableKind`

Following is the JSON for a default ad hoc variable:

```json
  "variables": [
    {
      "kind": "AdhocVariable",
      "spec": {
        "baseFilters": [],
        "defaultKeys": [],
        "filters": [],
        "hide": "dontHide",
        "name": "",
        "skipUrlSync": false
      }
    }
  ]
```

`AdhocVariableKind` consists of:

- kind: "AdhocVariable"
- spec: [AdhocVariableSpec](#adhocvariablespec)

### `AdhocVariableSpec`

The following table explains the usage of the ad hoc variable JSON fields:

| Name         | Usage                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| name         | string. Name of the variable.                                                                                                                |
| datasource?  | `DataSourceRef`. Consists of:<ul><li>type? - string. The plugin type-id.</li><li>uid? - string. The specific data source instance.</li></ul> |
| baseFilters  | [AdHocFilterWithLabels](#adhocfilterswithlabels)                                                                                             |
| filters      | [AdHocFilterWithLabels](#adhocfilterswithlabels)                                                                                             |
| defaultKeys  | [MetricFindValue](#metricfindvalue)                                                                                                          |
| label?       | string                                                                                                                                       |
| hide         | `VariableHide`. Options are: `dontHide`, `hideLabel`, and `hideVariable`.                                                                    |
| skipUrlSync  | bool. Default is `false`.                                                                                                                    |
| description? | string                                                                                                                                       |

#### `AdHocFiltersWithLabels`

The following table explains the usage of the ad hoc variable with labels JSON fields:

| Name         | Type          |
| ------------ | ------------- |
| key          | string        |
| operator     | string        |
| value        | string        |
| values?      | `[...string]` |
| keyLabel     | string        |
| valueLabels? | `[...string]` |
| forceEdit?   | bool          |

#### `MetricFindValue`

The following table explains the usage of the metric find value JSON fields:

| Name        | Type             |
| ----------- | ---------------- |
| text        | string           |
| value?      | string or number |
| group?      | string           |
| expandable? | bool             |
