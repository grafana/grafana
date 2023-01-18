---
keywords:
  - grafana
  - schema
title: Dashboard kind
---

# Dashboard kind

### Maturity: experimental
### Version: 0.0

## Properties

| Property               | Type                              | Required | Description                                                                                                                                                                                                             |
|------------------------|-----------------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `editable`             | boolean                           | **Yes**  | Whether a dashboard is editable or not. Default: `true`.                                                                                                                                                                |
| `graphTooltip`         | integer                           | **Yes**  | 0 for no shared crosshair or tooltip (default).<br/>1 for shared crosshair.<br/>2 for shared crosshair AND shared tooltip. Possible values are: `0`, `1`, `2`. Default: `0`.                                            |
| `revision`             | integer                           | **Yes**  | Version of the current dashboard data Default: `-1`.                                                                                                                                                                    |
| `schemaVersion`        | integer                           | **Yes**  | Version of the JSON schema, incremented each time a Grafana update brings<br/>changes to said schema.<br/>TODO this is the existing schema numbering system. It will be replaced by Thema's themaVersion Default: `36`. |
| `style`                | string                            | **Yes**  | Theme of dashboard. Possible values are: `dark`, `light`. Default: `dark`.                                                                                                                                              |
| `annotations`          | [object](#annotations)            | No       | TODO docs                                                                                                                                                                                                               |
| `description`          | string                            | No       | Description of dashboard.                                                                                                                                                                                               |
| `fiscalYearStartMonth` | integer                           | No       | TODO docs                                                                                                                                                                                                               |
| `gnetId`               | string                            | No       |                                                                                                                                                                                                                         |
| `id`                   | integer                           | No       | Unique numeric identifier for the dashboard.<br/>TODO must isolate or remove identifiers local to a Grafana instance...?                                                                                                |
| `links`                | [DashboardLink](#dashboardlink)[] | No       | TODO docs                                                                                                                                                                                                               |
| `liveNow`              | boolean                           | No       | TODO docs                                                                                                                                                                                                               |
| `panels`               | [object](#panels)[]               | No       |                                                                                                                                                                                                                         |
| `refresh`              |                                   | No       | TODO docs                                                                                                                                                                                                               |
| `snapshot`             | [Snapshot](#snapshot)             | No       | TODO docs                                                                                                                                                                                                               |
| `tags`                 | string[]                          | No       | Tags associated with dashboard.                                                                                                                                                                                         |
| `templating`           | [object](#templating)             | No       | TODO docs                                                                                                                                                                                                               |
| `time`                 | [object](#time)                   | No       | Time range for dashboard, e.g. last 6 hours, last 7 days, etc                                                                                                                                                           |
| `timepicker`           | [object](#timepicker)             | No       | TODO docs<br/>TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes                                                                                  |
| `timezone`             | string                            | No       | Timezone of dashboard, Possible values are: `browser`, `utc`, ``. Default: `browser`.                                                                                                                                   |
| `title`                | string                            | No       | Title of dashboard.                                                                                                                                                                                                     |
| `uid`                  | string                            | No       | Unique dashboard identifier that can be generated by anyone. string (8-40)                                                                                                                                              |
| `version`              | integer                           | No       | Version of the dashboard, incremented each time the dashboard is updated.                                                                                                                                               |
| `weekStart`            | string                            | No       | TODO docs                                                                                                                                                                                                               |

## DashboardLink

FROM public/app/features/dashboard/state/DashboardModels.ts - ish
TODO docs

### Properties

| Property      | Type     | Required | Description                                          |
|---------------|----------|----------|------------------------------------------------------|
| `asDropdown`  | boolean  | **Yes**  | Default: `false`.                                    |
| `icon`        | string   | **Yes**  |                                                      |
| `includeVars` | boolean  | **Yes**  | Default: `false`.                                    |
| `keepTime`    | boolean  | **Yes**  | Default: `false`.                                    |
| `tags`        | string[] | **Yes**  |                                                      |
| `targetBlank` | boolean  | **Yes**  | Default: `false`.                                    |
| `title`       | string   | **Yes**  |                                                      |
| `tooltip`     | string   | **Yes**  |                                                      |
| `type`        | string   | **Yes**  | TODO docs Possible values are: `link`, `dashboards`. |
| `url`         | string   | **Yes**  |                                                      |

## Snapshot

TODO docs

### Properties

| Property      | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `created`     | string  | **Yes**  | TODO docs   |
| `expires`     | string  | **Yes**  | TODO docs   |
| `externalUrl` | string  | **Yes**  | TODO docs   |
| `external`    | boolean | **Yes**  | TODO docs   |
| `id`          | integer | **Yes**  | TODO docs   |
| `key`         | string  | **Yes**  | TODO docs   |
| `name`        | string  | **Yes**  | TODO docs   |
| `orgId`       | integer | **Yes**  | TODO docs   |
| `updated`     | string  | **Yes**  | TODO docs   |
| `userId`      | integer | **Yes**  | TODO docs   |
| `url`         | string  | No       | TODO docs   |

## annotations

TODO docs

### Properties

| Property | Type                                  | Required | Description |
|----------|---------------------------------------|----------|-------------|
| `list`   | [AnnotationQuery](#annotationquery)[] | No       |             |

### AnnotationQuery

TODO docs
FROM: AnnotationQuery in grafana-data/src/types/annotations.ts

#### Properties

| Property     | Type                                  | Required | Description                                     |
|--------------|---------------------------------------|----------|-------------------------------------------------|
| `builtIn`    | integer                               | **Yes**  | Default: `0`.                                   |
| `datasource` | [object](#datasource)                 | **Yes**  | Datasource to use for annotation.               |
| `enable`     | boolean                               | **Yes**  | Whether annotation is enabled. Default: `true`. |
| `showIn`     | integer                               | **Yes**  | Default: `0`.                                   |
| `type`       | string                                | **Yes**  | Default: `dashboard`.                           |
| `hide`       | boolean                               | No       | Whether to hide annotation. Default: `false`.   |
| `iconColor`  | string                                | No       | Annotation icon color.                          |
| `name`       | string                                | No       | Name of annotation.                             |
| `rawQuery`   | string                                | No       | Query for annotation data.                      |
| `target`     | [AnnotationTarget](#annotationtarget) | No       | TODO docs                                       |

#### AnnotationTarget

TODO docs

##### Properties

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `limit`    | integer  | **Yes**  |             |
| `matchAny` | boolean  | **Yes**  |             |
| `tags`     | string[] | **Yes**  |             |
| `type`     | string   | **Yes**  |             |

#### datasource

Datasource to use for annotation.

##### Properties

| Property | Type   | Required | Description |
|----------|--------|----------|-------------|
| `type`   | string | No       |             |
| `uid`    | string | No       |             |

## panels

| Property | Type | Required | Description |
|----------|------|----------|-------------|

## templating

TODO docs

### Properties

| Property | Type                              | Required | Description |
|----------|-----------------------------------|----------|-------------|
| `list`   | [VariableModel](#variablemodel)[] | No       |             |

### VariableModel

FROM: packages/grafana-data/src/types/templateVars.ts
TODO docs
TODO what about what's in public/app/features/types.ts?
TODO there appear to be a lot of different kinds of [template] vars here? if so need a disjunction

#### Properties

| Property       | Type                            | Required | Description                                                                                                                                                                                                                                             |
|----------------|---------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `global`       | boolean                         | **Yes**  | Default: `false`.                                                                                                                                                                                                                                       |
| `hide`         | integer                         | **Yes**  | Possible values are: `0`, `1`, `2`.                                                                                                                                                                                                                     |
| `id`           | string                          | **Yes**  | Default: `00000000-0000-0000-0000-000000000000`.                                                                                                                                                                                                        |
| `index`        | integer                         | **Yes**  | Default: `-1`.                                                                                                                                                                                                                                          |
| `name`         | string                          | **Yes**  |                                                                                                                                                                                                                                                         |
| `skipUrlSync`  | boolean                         | **Yes**  | Default: `false`.                                                                                                                                                                                                                                       |
| `state`        | string                          | **Yes**  | Possible values are: `NotStarted`, `Loading`, `Streaming`, `Done`, `Error`.                                                                                                                                                                             |
| `type`         | string                          | **Yes**  | FROM: packages/grafana-data/src/types/templateVars.ts<br/>TODO docs<br/>TODO this implies some wider pattern/discriminated union, probably? Possible values are: `query`, `adhoc`, `constant`, `datasource`, `interval`, `textbox`, `custom`, `system`. |
| `datasource`   | [DataSourceRef](#datasourceref) | No       | Ref to a DataSource instance                                                                                                                                                                                                                            |
| `description`  | string                          | No       |                                                                                                                                                                                                                                                         |
| `error`        | [object](#error)                | No       |                                                                                                                                                                                                                                                         |
| `label`        | string                          | No       |                                                                                                                                                                                                                                                         |
| `query`        |                                 | No       | TODO: Move this into a separated QueryVariableModel type                                                                                                                                                                                                |
| `rootStateKey` | string                          | No       |                                                                                                                                                                                                                                                         |

#### DataSourceRef

Ref to a DataSource instance

##### Properties

| Property | Type   | Required | Description                  |
|----------|--------|----------|------------------------------|
| `type`   | string | No       | The plugin type-id           |
| `uid`    | string | No       | Specific datasource instance |

#### error

| Property | Type | Required | Description |
|----------|------|----------|-------------|

## time

Time range for dashboard, e.g. last 6 hours, last 7 days, etc

### Properties

| Property | Type   | Required | Description        |
|----------|--------|----------|--------------------|
| `from`   | string | **Yes**  | Default: `now-6h`. |
| `to`     | string | **Yes**  | Default: `now`.    |

## timepicker

TODO docs
TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes

### Properties

| Property            | Type     | Required | Description                                                                            |
|---------------------|----------|----------|----------------------------------------------------------------------------------------|
| `collapse`          | boolean  | **Yes**  | Whether timepicker is collapsed or not. Default: `false`.                              |
| `enable`            | boolean  | **Yes**  | Whether timepicker is enabled or not. Default: `true`.                                 |
| `hidden`            | boolean  | **Yes**  | Whether timepicker is visible or not. Default: `false`.                                |
| `refresh_intervals` | string[] | **Yes**  | Selectable intervals for auto-refresh. Default: `[5s 10s 30s 1m 5m 15m 30m 1h 2h 1d]`. |
| `time_options`      | string[] | **Yes**  | TODO docs Default: `[5m 15m 1h 6h 12h 24h 2d 7d 30d]`.                                 |


