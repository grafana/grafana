---
description: A reference for the JSON annotations schema used with Observability as Code.
keywords:
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
  - annotations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: annotations schema
title: annotations
weight: 100
---

# `annotations`

The configuration for the list of annotations that are associated with the dashboard.

```json
  "annotations": [
    {
      "kind": "AnnotationQuery",
      "spec": {
        "builtIn": false,
        "datasource": {
          "type": "",
          "uid": ""
        },
        "enable": false,
        "hide": false,
        "iconColor": "",
        "name": ""
      }
    }
  ],
```

`AnnotationsQueryKind` consists of:

- kind: "AnnotationQuery"
- spec: [AnnotationQuerySpec](#annotationqueryspec)

## `AnnotationQuerySpec`

| Name       | Type/Definition                                                   |
| ---------- | ----------------------------------------------------------------- |
| datasource | [`DataSourceRef`](#datasourceref)                                 |
| query      | [`DataQueryKind`](#dataquerykind)                                 |
| enable     | bool                                                              |
| hide       | bool                                                              |
| iconColor  | string                                                            |
| name       | string                                                            |
| builtIn    | bool. Default is `false`.                                         |
| filter     | [`AnnotationPanelFilter`](#annotationpanelfilter)                 |
| options    | `[string]`: A catch-all field for datasource-specific properties. |

### `DataSourceRef`

| Name  | Usage                              |
| ----- | ---------------------------------- |
| type? | string. The plugin type-id.        |
| uid?  | The specific data source instance. |

### `DataQueryKind`

| Name | Type   |
| ---- | ------ |
| kind | string |
| spec | string |

### `AnnotationPanelFilter`

| Name     | Type/Definition                                                                |
| -------- | ------------------------------------------------------------------------------ |
| exclude? | bool. Should the specified panels be included or excluded. Default is `false`. |
| ids      | `[...uint8]`. Panel IDs that should be included or excluded.                   |
