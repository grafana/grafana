---
keywords:
  - grafana
  - schema
title: Dashboard kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## Dashboard

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0

A Grafana dashboard.

| Property               | Type                              | Required | Default   | Description                                                                                                                                                                                                                                 |
|------------------------|-----------------------------------|----------|-----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `editable`             | boolean                           | **Yes**  | `true`    | Whether a dashboard is editable or not.                                                                                                                                                                                                     |
| `graphTooltip`         | integer                           | **Yes**  | `0`       | 0 for no shared crosshair or tooltip (default).<br/>1 for shared crosshair.<br/>2 for shared crosshair AND shared tooltip.<br/>Possible values are: `0`, `1`, `2`.                                                                          |
| `schemaVersion`        | uint16                            | **Yes**  | `36`      | Version of the JSON schema, incremented each time a Grafana update brings<br/>changes to said schema.<br/>TODO this is the existing schema numbering system. It will be replaced by Thema's themaVersion                                    |
| `style`                | string                            | **Yes**  | `dark`    | Theme of dashboard.<br/>Possible values are: `dark`, `light`.                                                                                                                                                                               |
| `annotations`          | [object](#annotations)            | No       |           | TODO docs                                                                                                                                                                                                                                   |
| `description`          | string                            | No       |           | Description of dashboard.                                                                                                                                                                                                                   |
| `fiscalYearStartMonth` | integer                           | No       | `0`       | The month that the fiscal year starts on.  0 = January, 11 = December<br/>Constraint: `>=0 & <12`.                                                                                                                                          |
| `gnetId`               | string                            | No       |           | For dashboards imported from the https://grafana.com/grafana/dashboards/ portal                                                                                                                                                             |
| `id`                   | integer                           | No       |           | Unique numeric identifier for the dashboard.<br/>TODO must isolate or remove identifiers local to a Grafana instance...?                                                                                                                    |
| `links`                | [DashboardLink](#dashboardlink)[] | No       |           | TODO docs                                                                                                                                                                                                                                   |
| `liveNow`              | boolean                           | No       |           | When set to true, the dashboard will redraw panels at an interval matching the pixel width.<br/>This will keep data "moving left" regardless of the query refresh rate.  This setting helps<br/>avoid dashboards presenting stale live data |
| `panels`               | [object](#panels)[]               | No       |           |                                                                                                                                                                                                                                             |
| `refresh`              |                                   | No       |           | Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d".                                                                                                                                                    |
| `revision`             | integer                           | No       |           | This property should only be used in dashboards defined by plugins.  It is a quick check<br/>to see if the version has changed since the last time.  Unclear why using the version property<br/>is insufficient.                            |
| `snapshot`             | [Snapshot](#snapshot)             | No       |           | TODO docs                                                                                                                                                                                                                                   |
| `tags`                 | string[]                          | No       |           | Tags associated with dashboard.                                                                                                                                                                                                             |
| `templating`           | [object](#templating)             | No       |           | TODO docs                                                                                                                                                                                                                                   |
| `time`                 | [object](#time)                   | No       |           | Time range for dashboard, e.g. last 6 hours, last 7 days, etc                                                                                                                                                                               |
| `timepicker`           | [object](#timepicker)             | No       |           | TODO docs<br/>TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes                                                                                                      |
| `timezone`             | string                            | No       | `browser` | Timezone of dashboard. Accepts IANA TZDB zone ID or "browser" or "utc".                                                                                                                                                                     |
| `title`                | string                            | No       |           | Title of dashboard.                                                                                                                                                                                                                         |
| `uid`                  | string                            | No       |           | Unique dashboard identifier that can be generated by anyone. string (8-40)                                                                                                                                                                  |
| `version`              | uint32                            | No       |           | Version of the dashboard, incremented each time the dashboard is updated.                                                                                                                                                                   |
| `weekStart`            | string                            | No       |           | TODO docs                                                                                                                                                                                                                                   |

### DashboardLink

FROM public/app/features/dashboard/state/DashboardModels.ts - ish
TODO docs

| Property      | Type     | Required | Default | Description                                              |
|---------------|----------|----------|---------|----------------------------------------------------------|
| `asDropdown`  | boolean  | **Yes**  | `false` |                                                          |
| `icon`        | string   | **Yes**  |         |                                                          |
| `includeVars` | boolean  | **Yes**  | `false` |                                                          |
| `keepTime`    | boolean  | **Yes**  | `false` |                                                          |
| `tags`        | string[] | **Yes**  |         |                                                          |
| `targetBlank` | boolean  | **Yes**  | `false` |                                                          |
| `title`       | string   | **Yes**  |         |                                                          |
| `tooltip`     | string   | **Yes**  |         |                                                          |
| `type`        | string   | **Yes**  |         | TODO docs<br/>Possible values are: `link`, `dashboards`. |
| `url`         | string   | **Yes**  |         |                                                          |

### Snapshot

TODO docs

| Property      | Type    | Required | Default | Description |
|---------------|---------|----------|---------|-------------|
| `created`     | string  | **Yes**  |         | TODO docs   |
| `expires`     | string  | **Yes**  |         | TODO docs   |
| `externalUrl` | string  | **Yes**  |         | TODO docs   |
| `external`    | boolean | **Yes**  |         | TODO docs   |
| `id`          | uint32  | **Yes**  |         | TODO docs   |
| `key`         | string  | **Yes**  |         | TODO docs   |
| `name`        | string  | **Yes**  |         | TODO docs   |
| `orgId`       | uint32  | **Yes**  |         | TODO docs   |
| `updated`     | string  | **Yes**  |         | TODO docs   |
| `userId`      | uint32  | **Yes**  |         | TODO docs   |
| `url`         | string  | No       |         | TODO docs   |

### Annotations

TODO docs

| Property | Type                                  | Required | Default | Description |
|----------|---------------------------------------|----------|---------|-------------|
| `list`   | [AnnotationQuery](#annotationquery)[] | No       |         |             |

### AnnotationQuery

TODO docs
FROM: AnnotationQuery in grafana-data/src/types/annotations.ts

| Property     | Type                                  | Required | Default     | Description                       |
|--------------|---------------------------------------|----------|-------------|-----------------------------------|
| `builtIn`    | uint8                                 | **Yes**  | `0`         |                                   |
| `datasource` | [object](#datasource)                 | **Yes**  |             | Datasource to use for annotation. |
| `enable`     | boolean                               | **Yes**  | `true`      | Whether annotation is enabled.    |
| `showIn`     | uint8                                 | **Yes**  | `0`         |                                   |
| `type`       | string                                | **Yes**  | `dashboard` |                                   |
| `hide`       | boolean                               | No       | `false`     | Whether to hide annotation.       |
| `iconColor`  | string                                | No       |             | Annotation icon color.            |
| `name`       | string                                | No       |             | Name of annotation.               |
| `rawQuery`   | string                                | No       |             | Query for annotation data.        |
| `target`     | [AnnotationTarget](#annotationtarget) | No       |             | TODO docs                         |

### AnnotationTarget

TODO docs

| Property   | Type     | Required | Default | Description |
|------------|----------|----------|---------|-------------|
| `limit`    | integer  | **Yes**  |         |             |
| `matchAny` | boolean  | **Yes**  |         |             |
| `tags`     | string[] | **Yes**  |         |             |
| `type`     | string   | **Yes**  |         |             |

### Datasource

Datasource to use for annotation.

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | No       |         |             |
| `uid`    | string | No       |         |             |

### Panels

| Property | Type                                                                                                                  | Required | Default | Description |
|----------|-----------------------------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [Panel](#panel), [RowPanel](#rowpanel), [GraphPanel](#graphpanel), [HeatmapPanel](#heatmappanel). |          |         |

### DataTransformerConfig

TODO docs

| Property   | Type                            | Required | Default | Description                                                                            |
|------------|---------------------------------|----------|---------|----------------------------------------------------------------------------------------|
| `id`       | string                          | **Yes**  |         | Unique identifier of transformer                                                       |
| `options`  |                                 | **Yes**  |         | Options to be passed to the transformer<br/>Valid options depend on the transformer id |
| `disabled` | boolean                         | No       |         | Disabled transformations are skipped                                                   |
| `filter`   | [MatcherConfig](#matcherconfig) | No       |         |                                                                                        |

### MatcherConfig

| Property  | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| `id`      | string | **Yes**  | ``      |             |
| `options` |        | No       |         |             |

### FieldConfigSource

| Property    | Type                        | Required | Default | Description |
|-------------|-----------------------------|----------|---------|-------------|
| `defaults`  | [FieldConfig](#fieldconfig) | **Yes**  |         |             |
| `overrides` | [object](#overrides)[]      | **Yes**  |         |             |

### FieldConfig

| Property            | Type                                  | Required | Default | Description                                                                                                                                                                                                                                                                             |
|---------------------|---------------------------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `color`             | [FieldColor](#fieldcolor)             | No       |         | TODO docs                                                                                                                                                                                                                                                                               |
| `custom`            | [object](#custom)                     | No       |         | custom is specified by the PanelFieldConfig field<br/>in panel plugin schemas.                                                                                                                                                                                                          |
| `decimals`          | number                                | No       |         | Significant digits (for display)                                                                                                                                                                                                                                                        |
| `description`       | string                                | No       |         | Human readable field metadata                                                                                                                                                                                                                                                           |
| `displayNameFromDS` | string                                | No       |         | This can be used by data sources that return and explicit naming structure for values and labels<br/>When this property is configured, this value is used rather than the default naming strategy.                                                                                      |
| `displayName`       | string                                | No       |         | The display value for this field.  This supports template variables blank is auto                                                                                                                                                                                                       |
| `filterable`        | boolean                               | No       |         | True if data source field supports ad-hoc filters                                                                                                                                                                                                                                       |
| `links`             |                                       | No       |         | The behavior when clicking on a result                                                                                                                                                                                                                                                  |
| `mappings`          | [ValueMapping](#valuemapping)[]       | No       |         | Convert input values into a display string                                                                                                                                                                                                                                              |
| `max`               | number                                | No       |         |                                                                                                                                                                                                                                                                                         |
| `min`               | number                                | No       |         |                                                                                                                                                                                                                                                                                         |
| `noValue`           | string                                | No       |         | Alternative to empty string                                                                                                                                                                                                                                                             |
| `path`              | string                                | No       |         | An explicit path to the field in the datasource.  When the frame meta includes a path,<br/>This will default to `${frame.meta.path}/${field.name}<br/><br/>When defined, this value can be used as an identifier within the datasource scope, and<br/>may be used to update the results |
| `thresholds`        | [ThresholdsConfig](#thresholdsconfig) | No       |         |                                                                                                                                                                                                                                                                                         |
| `unit`              | string                                | No       |         | Numeric Options                                                                                                                                                                                                                                                                         |
| `writeable`         | boolean                               | No       |         | True if data source can write a value to the path.  Auth/authz are supported separately                                                                                                                                                                                                 |

### FieldColor

TODO docs

| Property     | Type   | Required | Default | Description                                              |
|--------------|--------|----------|---------|----------------------------------------------------------|
| `mode`       | string | **Yes**  |         | The main color scheme mode                               |
| `fixedColor` | string | No       |         | Stores the fixed color value if mode is fixed            |
| `seriesBy`   | string | No       |         | TODO docs<br/>Possible values are: `min`, `max`, `last`. |

### ThresholdsConfig

| Property | Type                      | Required | Default | Description                                                |
|----------|---------------------------|----------|---------|------------------------------------------------------------|
| `mode`   | string                    | **Yes**  |         | Possible values are: `absolute`, `percentage`.             |
| `steps`  | [Threshold](#threshold)[] | **Yes**  |         | Must be sorted by 'value', first value is always -Infinity |

### Threshold

TODO docs

| Property | Type    | Required | Default | Description                                                                                                                                         |
|----------|---------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `color`  | string  | **Yes**  |         | TODO docs                                                                                                                                           |
| `index`  | integer | No       |         | Threshold index, an old property that is not needed an should only appear in older dashboards                                                       |
| `state`  | string  | No       |         | TODO docs<br/>TODO are the values here enumerable into a disjunction?<br/>Some seem to be listed in typescript comment                              |
| `value`  | number  | No       |         | TODO docs<br/>FIXME the corresponding typescript field is required/non-optional, but nulls currently appear here when serializing -Infinity to JSON |

### ValueMapping

TODO docs

| Property | Type                                                                                                                          | Required | Default | Description |
|----------|-------------------------------------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [ValueMap](#valuemap), [RangeMap](#rangemap), [RegexMap](#regexmap), [SpecialValueMap](#specialvaluemap). |          |         |

### RangeMap

TODO docs

| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `options` | [object](#options) | **Yes**  |         |             |
| `type`    | string             | **Yes**  |         |             |

### Options

| Property | Type                                      | Required | Default | Description                                                                    |
|----------|-------------------------------------------|----------|---------|--------------------------------------------------------------------------------|
| `from`   | number                                    | **Yes**  |         | to and from are `number &#124; null` in current ts, really not sure what to do |
| `result` | [ValueMappingResult](#valuemappingresult) | **Yes**  |         | TODO docs                                                                      |
| `to`     | number                                    | **Yes**  |         |                                                                                |

### ValueMappingResult

TODO docs

| Property | Type    | Required | Default | Description |
|----------|---------|----------|---------|-------------|
| `color`  | string  | No       |         |             |
| `icon`   | string  | No       |         |             |
| `index`  | integer | No       |         |             |
| `text`   | string  | No       |         |             |

### RegexMap

TODO docs

| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `options` | [object](#options) | **Yes**  |         |             |
| `type`    | string             | **Yes**  |         |             |

### Options

| Property  | Type                                      | Required | Default | Description |
|-----------|-------------------------------------------|----------|---------|-------------|
| `pattern` | string                                    | **Yes**  |         |             |
| `result`  | [ValueMappingResult](#valuemappingresult) | **Yes**  |         | TODO docs   |

### SpecialValueMap

TODO docs

| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `options` | [object](#options) | **Yes**  |         |             |
| `type`    | string             | **Yes**  |         |             |

### Options

| Property  | Type                                      | Required | Default | Description                           |
|-----------|-------------------------------------------|----------|---------|---------------------------------------|
| `match`   | string                                    | **Yes**  |         | Possible values are: `true`, `false`. |
| `pattern` | string                                    | **Yes**  |         |                                       |
| `result`  | [ValueMappingResult](#valuemappingresult) | **Yes**  |         | TODO docs                             |

### ValueMap

TODO docs

| Property  | Type                                                 | Required | Default | Description |
|-----------|------------------------------------------------------|----------|---------|-------------|
| `options` | map[string][ValueMappingResult](#valuemappingresult) | **Yes**  |         |             |
| `type`    | string                                               | **Yes**  |         |             |

### Custom

custom is specified by the PanelFieldConfig field
in panel plugin schemas.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Overrides

| Property     | Type                                        | Required | Default | Description |
|--------------|---------------------------------------------|----------|---------|-------------|
| `matcher`    | [MatcherConfig](#matcherconfig)             | **Yes**  |         |             |
| `properties` | [DynamicConfigValue](#dynamicconfigvalue)[] | **Yes**  |         |             |

### DynamicConfigValue

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `id`     | string | **Yes**  | ``      |             |
| `value`  |        | No       |         |             |

### GraphPanel

Support for legacy graph and heatmap panels.

| Property | Type              | Required | Default | Description                                        |
|----------|-------------------|----------|---------|----------------------------------------------------|
| `type`   | string            | **Yes**  |         | Possible values are: `graph`.                      |
| `legend` | [object](#legend) | No       |         | @deprecated this is part of deprecated graph panel |

### Legend

@deprecated this is part of deprecated graph panel

| Property   | Type    | Required | Default | Description |
|------------|---------|----------|---------|-------------|
| `show`     | boolean | **Yes**  | `true`  |             |
| `sortDesc` | boolean | No       |         |             |
| `sort`     | string  | No       |         |             |

### GridPos

| Property | Type    | Required | Default | Description                          |
|----------|---------|----------|---------|--------------------------------------|
| `h`      | uint32  | **Yes**  | `9`     | Panel                                |
| `w`      | integer | **Yes**  | `12`    | Panel<br/>Constraint: `>0 & <=24`.   |
| `x`      | integer | **Yes**  | `0`     | Panel x<br/>Constraint: `>=0 & <24`. |
| `y`      | uint32  | **Yes**  | `0`     | Panel y                              |
| `static` | boolean | No       |         | true if fixed                        |

### HeatmapPanel

| Property | Type   | Required | Default | Description                     |
|----------|--------|----------|---------|---------------------------------|
| `type`   | string | **Yes**  |         | Possible values are: `heatmap`. |

### LibraryPanelRef

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `name`   | string | **Yes**  |         |             |
| `uid`    | string | **Yes**  |         |             |

### Panel

Dashboard panels. Panels are canonically defined inline
because they share a version timeline with the dashboard
schema; they do not evolve independently.

| Property          | Type                                              | Required | Default | Description                                                                                                                                                |
|-------------------|---------------------------------------------------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `fieldConfig`     | [FieldConfigSource](#fieldconfigsource)           | **Yes**  |         |                                                                                                                                                            |
| `options`         | [object](#options)                                | **Yes**  |         | options is specified by the PanelOptions field in panel<br/>plugin schemas.                                                                                |
| `repeatDirection` | string                                            | **Yes**  | `h`     | Direction to repeat in if 'repeat' is set.<br/>"h" for horizontal, "v" for vertical.<br/>TODO this is probably optional<br/>Possible values are: `h`, `v`. |
| `transformations` | [DataTransformerConfig](#datatransformerconfig)[] | **Yes**  |         |                                                                                                                                                            |
| `transparent`     | boolean                                           | **Yes**  | `false` | Whether to display the panel without a background.                                                                                                         |
| `type`            | string                                            | **Yes**  |         | The panel plugin type id. May not be empty.<br/>Constraint: `length >=1`.                                                                                  |
| `datasource`      | [object](#datasource)                             | No       |         | The datasource used in all targets.                                                                                                                        |
| `description`     | string                                            | No       |         | Description.                                                                                                                                               |
| `gridPos`         | [GridPos](#gridpos)                               | No       |         |                                                                                                                                                            |
| `id`              | uint32                                            | No       |         | TODO docs                                                                                                                                                  |
| `interval`        | string                                            | No       |         | TODO docs<br/>TODO tighter constraint                                                                                                                      |
| `libraryPanel`    | [LibraryPanelRef](#librarypanelref)               | No       |         |                                                                                                                                                            |
| `links`           | [DashboardLink](#dashboardlink)[]                 | No       |         | Panel links.<br/>TODO fill this out - seems there are a couple variants?                                                                                   |
| `maxDataPoints`   | number                                            | No       |         | TODO docs                                                                                                                                                  |
| `pluginVersion`   | string                                            | No       |         | FIXME this almost certainly has to be changed in favor of scuemata versions                                                                                |
| `repeatPanelId`   | integer                                           | No       |         | Id of the repeating panel.                                                                                                                                 |
| `repeat`          | string                                            | No       |         | Name of template variable to repeat for.                                                                                                                   |
| `tags`            | string[]                                          | No       |         | TODO docs                                                                                                                                                  |
| `targets`         | [Target](#target)[]                               | No       |         | TODO docs                                                                                                                                                  |
| `thresholds`      |                                                   | No       |         | TODO docs - seems to be an old field from old dashboard alerts?                                                                                            |
| `timeFrom`        | string                                            | No       |         | TODO docs<br/>TODO tighter constraint                                                                                                                      |
| `timeRegions`     |                                                   | No       |         | TODO docs                                                                                                                                                  |
| `timeShift`       | string                                            | No       |         | TODO docs<br/>TODO tighter constraint                                                                                                                      |
| `title`           | string                                            | No       |         | Panel title.                                                                                                                                               |

### FieldConfigSource

| Property    | Type                        | Required | Default | Description |
|-------------|-----------------------------|----------|---------|-------------|
| `defaults`  | [FieldConfig](#fieldconfig) | **Yes**  |         |             |
| `overrides` | [overrides](#overrides)[]   | **Yes**  |         |             |

### FieldConfig

| Property            | Type                                  | Required | Default | Description                                                                                                                                                                                                                                                                             |
|---------------------|---------------------------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `color`             | [FieldColor](#fieldcolor)             | No       |         | TODO docs                                                                                                                                                                                                                                                                               |
| `custom`            | [custom](#custom)                     | No       |         | custom is specified by the PanelFieldConfig field<br/>in panel plugin schemas.                                                                                                                                                                                                          |
| `decimals`          | number                                | No       |         | Significant digits (for display)                                                                                                                                                                                                                                                        |
| `description`       | string                                | No       |         | Human readable field metadata                                                                                                                                                                                                                                                           |
| `displayNameFromDS` | string                                | No       |         | This can be used by data sources that return and explicit naming structure for values and labels<br/>When this property is configured, this value is used rather than the default naming strategy.                                                                                      |
| `displayName`       | string                                | No       |         | The display value for this field.  This supports template variables blank is auto                                                                                                                                                                                                       |
| `filterable`        | boolean                               | No       |         | True if data source field supports ad-hoc filters                                                                                                                                                                                                                                       |
| `links`             |                                       | No       |         | The behavior when clicking on a result                                                                                                                                                                                                                                                  |
| `mappings`          | [ValueMapping](#valuemapping)[]       | No       |         | Convert input values into a display string                                                                                                                                                                                                                                              |
| `max`               | number                                | No       |         |                                                                                                                                                                                                                                                                                         |
| `min`               | number                                | No       |         |                                                                                                                                                                                                                                                                                         |
| `noValue`           | string                                | No       |         | Alternative to empty string                                                                                                                                                                                                                                                             |
| `path`              | string                                | No       |         | An explicit path to the field in the datasource.  When the frame meta includes a path,<br/>This will default to `${frame.meta.path}/${field.name}<br/><br/>When defined, this value can be used as an identifier within the datasource scope, and<br/>may be used to update the results |
| `thresholds`        | [ThresholdsConfig](#thresholdsconfig) | No       |         |                                                                                                                                                                                                                                                                                         |
| `unit`              | string                                | No       |         | Numeric Options                                                                                                                                                                                                                                                                         |
| `writeable`         | boolean                               | No       |         | True if data source can write a value to the path.  Auth/authz are supported separately                                                                                                                                                                                                 |

### RangeMap

TODO docs

| Property  | Type                | Required | Default | Description |
|-----------|---------------------|----------|---------|-------------|
| `options` | [options](#options) | **Yes**  |         |             |
| `type`    | string              | **Yes**  |         |             |

### RegexMap

TODO docs

| Property  | Type                | Required | Default | Description |
|-----------|---------------------|----------|---------|-------------|
| `options` | [options](#options) | **Yes**  |         |             |
| `type`    | string              | **Yes**  |         |             |

### SpecialValueMap

TODO docs

| Property  | Type                | Required | Default | Description |
|-----------|---------------------|----------|---------|-------------|
| `options` | [options](#options) | **Yes**  |         |             |
| `type`    | string              | **Yes**  |         |             |

### Target

Schema for panel targets is specified by datasource
plugins. We use a placeholder definition, which the Go
schema loader either left open/as-is with the Base
variant of the Dashboard and Panel families, or filled
with types derived from plugins in the Instance variant.
When working directly from CUE, importers can extend this
type directly to achieve the same effect.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Datasource

The datasource used in all targets.

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | No       |         |             |
| `uid`    | string | No       |         |             |

### Options

options is specified by the PanelOptions field in panel
plugin schemas.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### RowPanel

Row panel

| Property     | Type                  | Required | Default | Description                              |
|--------------|-----------------------|----------|---------|------------------------------------------|
| `collapsed`  | boolean               | **Yes**  | `false` |                                          |
| `id`         | uint32                | **Yes**  |         |                                          |
| `panels`     | [panels](#panels)[]   | **Yes**  |         |                                          |
| `type`       | string                | **Yes**  |         | Possible values are: `row`.              |
| `datasource` | [object](#datasource) | No       |         | Name of default datasource.              |
| `gridPos`    | [GridPos](#gridpos)   | No       |         |                                          |
| `repeat`     | string                | No       |         | Name of template variable to repeat for. |
| `title`      | string                | No       |         |                                          |

### Datasource

Name of default datasource.

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `type`   | string | No       |         |             |
| `uid`    | string | No       |         |             |

### Panels

| Property | Type                                                                                           | Required | Default | Description |
|----------|------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [Panel](#panel), [GraphPanel](#graphpanel), [HeatmapPanel](#heatmappanel). |          |         |

### GraphPanel

Support for legacy graph and heatmap panels.

| Property | Type              | Required | Default | Description                                        |
|----------|-------------------|----------|---------|----------------------------------------------------|
| `type`   | string            | **Yes**  |         | Possible values are: `graph`.                      |
| `legend` | [legend](#legend) | No       |         | @deprecated this is part of deprecated graph panel |

### Panel

Dashboard panels. Panels are canonically defined inline
because they share a version timeline with the dashboard
schema; they do not evolve independently.

| Property          | Type                                              | Required | Default | Description                                                                                                                                                |
|-------------------|---------------------------------------------------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `fieldConfig`     | [FieldConfigSource](#fieldconfigsource)           | **Yes**  |         |                                                                                                                                                            |
| `options`         | [options](#options)                               | **Yes**  |         | options is specified by the PanelOptions field in panel<br/>plugin schemas.                                                                                |
| `repeatDirection` | string                                            | **Yes**  | `h`     | Direction to repeat in if 'repeat' is set.<br/>"h" for horizontal, "v" for vertical.<br/>TODO this is probably optional<br/>Possible values are: `h`, `v`. |
| `transformations` | [DataTransformerConfig](#datatransformerconfig)[] | **Yes**  |         |                                                                                                                                                            |
| `transparent`     | boolean                                           | **Yes**  | `false` | Whether to display the panel without a background.                                                                                                         |
| `type`            | string                                            | **Yes**  |         | The panel plugin type id. May not be empty.<br/>Constraint: `length >=1`.                                                                                  |
| `datasource`      | [datasource](#datasource)                         | No       |         | The datasource used in all targets.                                                                                                                        |
| `description`     | string                                            | No       |         | Description.                                                                                                                                               |
| `gridPos`         | [GridPos](#gridpos)                               | No       |         |                                                                                                                                                            |
| `id`              | uint32                                            | No       |         | TODO docs                                                                                                                                                  |
| `interval`        | string                                            | No       |         | TODO docs<br/>TODO tighter constraint                                                                                                                      |
| `libraryPanel`    | [LibraryPanelRef](#librarypanelref)               | No       |         |                                                                                                                                                            |
| `links`           | [DashboardLink](#dashboardlink)[]                 | No       |         | Panel links.<br/>TODO fill this out - seems there are a couple variants?                                                                                   |
| `maxDataPoints`   | number                                            | No       |         | TODO docs                                                                                                                                                  |
| `pluginVersion`   | string                                            | No       |         | FIXME this almost certainly has to be changed in favor of scuemata versions                                                                                |
| `repeatPanelId`   | integer                                           | No       |         | Id of the repeating panel.                                                                                                                                 |
| `repeat`          | string                                            | No       |         | Name of template variable to repeat for.                                                                                                                   |
| `tags`            | string[]                                          | No       |         | TODO docs                                                                                                                                                  |
| `targets`         | [Target](#target)[]                               | No       |         | TODO docs                                                                                                                                                  |
| `thresholds`      |                                                   | No       |         | TODO docs - seems to be an old field from old dashboard alerts?                                                                                            |
| `timeFrom`        | string                                            | No       |         | TODO docs<br/>TODO tighter constraint                                                                                                                      |
| `timeRegions`     |                                                   | No       |         | TODO docs                                                                                                                                                  |
| `timeShift`       | string                                            | No       |         | TODO docs<br/>TODO tighter constraint                                                                                                                      |
| `title`           | string                                            | No       |         | Panel title.                                                                                                                                               |

### Templating

TODO docs

| Property | Type                              | Required | Default | Description |
|----------|-----------------------------------|----------|---------|-------------|
| `list`   | [VariableModel](#variablemodel)[] | No       |         |             |

### VariableModel

FROM: packages/grafana-data/src/types/templateVars.ts
TODO docs
TODO what about what's in public/app/features/types.ts?
TODO there appear to be a lot of different kinds of [template] vars here? if so need a disjunction

| Property       | Type                            | Required | Default                                | Description                                                                                                                                                                                                                                                 |
|----------------|---------------------------------|----------|----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `global`       | boolean                         | **Yes**  | `false`                                |                                                                                                                                                                                                                                                             |
| `hide`         | integer                         | **Yes**  |                                        | Possible values are: `0`, `1`, `2`.                                                                                                                                                                                                                         |
| `id`           | string                          | **Yes**  | `00000000-0000-0000-0000-000000000000` |                                                                                                                                                                                                                                                             |
| `index`        | int32                           | **Yes**  | `-1`                                   |                                                                                                                                                                                                                                                             |
| `name`         | string                          | **Yes**  |                                        |                                                                                                                                                                                                                                                             |
| `skipUrlSync`  | boolean                         | **Yes**  | `false`                                |                                                                                                                                                                                                                                                             |
| `state`        | string                          | **Yes**  |                                        | Possible values are: `NotStarted`, `Loading`, `Streaming`, `Done`, `Error`.                                                                                                                                                                                 |
| `type`         | string                          | **Yes**  |                                        | FROM: packages/grafana-data/src/types/templateVars.ts<br/>TODO docs<br/>TODO this implies some wider pattern/discriminated union, probably?<br/>Possible values are: `query`, `adhoc`, `constant`, `datasource`, `interval`, `textbox`, `custom`, `system`. |
| `datasource`   | [DataSourceRef](#datasourceref) | No       |                                        | Ref to a DataSource instance                                                                                                                                                                                                                                |
| `description`  | string                          | No       |                                        |                                                                                                                                                                                                                                                             |
| `error`        | [object](#error)                | No       |                                        |                                                                                                                                                                                                                                                             |
| `label`        | string                          | No       |                                        |                                                                                                                                                                                                                                                             |
| `query`        |                                 | No       |                                        | TODO: Move this into a separated QueryVariableModel type                                                                                                                                                                                                    |
| `rootStateKey` | string                          | No       |                                        |                                                                                                                                                                                                                                                             |

### DataSourceRef

Ref to a DataSource instance

| Property | Type   | Required | Default | Description                  |
|----------|--------|----------|---------|------------------------------|
| `type`   | string | No       |         | The plugin type-id           |
| `uid`    | string | No       |         | Specific datasource instance |

### Error

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Time

Time range for dashboard, e.g. last 6 hours, last 7 days, etc

| Property | Type   | Required | Default  | Description |
|----------|--------|----------|----------|-------------|
| `from`   | string | **Yes**  | `now-6h` |             |
| `to`     | string | **Yes**  | `now`    |             |

### Timepicker

TODO docs
TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes

| Property            | Type     | Required | Default                               | Description                             |
|---------------------|----------|----------|---------------------------------------|-----------------------------------------|
| `collapse`          | boolean  | **Yes**  | `false`                               | Whether timepicker is collapsed or not. |
| `enable`            | boolean  | **Yes**  | `true`                                | Whether timepicker is enabled or not.   |
| `hidden`            | boolean  | **Yes**  | `false`                               | Whether timepicker is visible or not.   |
| `refresh_intervals` | string[] | **Yes**  | `[5s 10s 30s 1m 5m 15m 30m 1h 2h 1d]` | Selectable intervals for auto-refresh.  |
| `time_options`      | string[] | **Yes**  | `[5m 15m 1h 6h 12h 24h 2d 7d 30d]`    | TODO docs                               |


