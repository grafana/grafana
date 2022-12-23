---
draft: true
keywords:
  - grafana
  - schema
title: Dashboard kind
---

# Dashboard kind

### Maturity: merged

### Version: 0.0

## Properties

| Property               | Type                   | Required | Description                                                                                                              |
| ---------------------- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `editable`             | boolean                | **Yes**  | Whether a dashboard is editable or not.                                                                                  |
| `graphTooltip`         | integer                | **Yes**  | 0 for no shared crosshair or tooltip (default).                                                                          |
|                        |                        |          | 1 for shared crosshair.                                                                                                  |
|                        |                        |          | 2 for shared crosshair AND shared tooltip. Possible values are: `0`, `1`, `2`.                                           |
| `revision`             | integer                | **Yes**  | Version of the current dashboard data                                                                                    |
| `schemaVersion`        | integer                | **Yes**  | Version of the JSON schema, incremented each time a Grafana update brings                                                |
|                        |                        |          | changes to said schema.                                                                                                  |
|                        |                        |          | TODO this is the existing schema numbering system. It will be replaced by Thema's themaVersion                           |
| `style`                | string                 | **Yes**  | Theme of dashboard. Possible values are: `dark`, `light`.                                                                |
| `annotations`          | [object](#annotations) | No       | TODO docs                                                                                                                |
| `description`          | string                 | No       | Description of dashboard.                                                                                                |
| `fiscalYearStartMonth` | integer                | No       | TODO docs                                                                                                                |
| `gnetId`               | string                 | No       |                                                                                                                          |
| `id`                   | integer                | No       | Unique numeric identifier for the dashboard.                                                                             |
|                        |                        |          | TODO must isolate or remove identifiers local to a Grafana instance...?                                                  |
| `links`                | [object](#links)[]     | No       | TODO docs                                                                                                                |
| `liveNow`              | boolean                | No       | TODO docs                                                                                                                |
| `panels`               | [object](#panels)[]    | No       |                                                                                                                          |
| `refresh`              |                        | No       | TODO docs                                                                                                                |
| `snapshot`             | [object](#snapshot)    | No       | TODO docs                                                                                                                |
| `tags`                 | string[]               | No       | Tags associated with dashboard.                                                                                          |
| `templating`           | [object](#templating)  | No       | TODO docs                                                                                                                |
| `time`                 | [object](#time)        | No       | Time range for dashboard, e.g. last 6 hours, last 7 days, etc                                                            |
| `timepicker`           | [object](#timepicker)  | No       | TODO docs                                                                                                                |
|                        |                        |          | TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes |
| `timezone`             | string                 | No       | Timezone of dashboard, Possible values are: `browser`, `utc`, ``.                                                        |
| `title`                | string                 | No       | Title of dashboard.                                                                                                      |
| `uid`                  | string                 | No       | Unique dashboard identifier that can be generated by anyone. string (8-40)                                               |
| `version`              | integer                | No       | Version of the dashboard, incremented each time the dashboard is updated.                                                |
| `weekStart`            | string                 | No       | TODO docs                                                                                                                |

## annotations

TODO docs

### Properties

| Property | Type              | Required | Description |
| -------- | ----------------- | -------- | ----------- |
| `list`   | [object](#list)[] | No       |             |

### list

TODO docs
FROM: AnnotationQuery in grafana-data/src/types/annotations.ts

#### Properties

| Property     | Type                  | Required | Description                       |
| ------------ | --------------------- | -------- | --------------------------------- |
| `builtIn`    | integer               | **Yes**  |                                   |
| `datasource` | [object](#datasource) | **Yes**  | Datasource to use for annotation. |
| `enable`     | boolean               | **Yes**  | Whether annotation is enabled.    |
| `showIn`     | integer               | **Yes**  |                                   |
| `type`       | string                | **Yes**  |                                   |
| `hide`       | boolean               | No       | Whether to hide annotation.       |
| `iconColor`  | string                | No       | Annotation icon color.            |
| `name`       | string                | No       | Name of annotation.               |
| `rawQuery`   | string                | No       | Query for annotation data.        |
| `target`     | [object](#target)     | No       | TODO docs                         |

#### datasource

Datasource to use for annotation.

##### Properties

| Property | Type   | Required | Description |
| -------- | ------ | -------- | ----------- |
| `type`   | string | No       |             |
| `uid`    | string | No       |             |

#### target

TODO docs

##### Properties

| Property   | Type     | Required | Description |
| ---------- | -------- | -------- | ----------- |
| `limit`    | integer  | **Yes**  |             |
| `matchAny` | boolean  | **Yes**  |             |
| `tags`     | string[] | **Yes**  |             |
| `type`     | string   | **Yes**  |             |

## links

FROM public/app/features/dashboard/state/DashboardModels.ts - ish
TODO docs

### Properties

| Property      | Type     | Required | Description                                          |
| ------------- | -------- | -------- | ---------------------------------------------------- |
| `asDropdown`  | boolean  | **Yes**  |                                                      |
| `icon`        | string   | **Yes**  |                                                      |
| `includeVars` | boolean  | **Yes**  |                                                      |
| `keepTime`    | boolean  | **Yes**  |                                                      |
| `tags`        | string[] | **Yes**  |                                                      |
| `targetBlank` | boolean  | **Yes**  |                                                      |
| `title`       | string   | **Yes**  |                                                      |
| `tooltip`     | string   | **Yes**  |                                                      |
| `type`        | string   | **Yes**  | TODO docs Possible values are: `link`, `dashboards`. |
| `url`         | string   | **Yes**  |                                                      |

## panels

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |

## snapshot

TODO docs

### Properties

| Property      | Type    | Required | Description |
| ------------- | ------- | -------- | ----------- |
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

## templating

TODO docs

### Properties

| Property | Type              | Required | Description |
| -------- | ----------------- | -------- | ----------- |
| `list`   | [object](#list)[] | No       |             |

### list

FROM: packages/grafana-data/src/types/templateVars.ts
TODO docs
TODO what about what's in public/app/features/types.ts?
TODO there appear to be a lot of different kinds of [template] vars here? if so need a disjunction

#### Properties

| Property       | Type                  | Required | Description                                                                                                                                                                     |
| -------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global`       | boolean               | **Yes**  |                                                                                                                                                                                 |
| `hide`         | integer               | **Yes**  | Possible values are: `0`, `1`, `2`.                                                                                                                                             |
| `id`           | string                | **Yes**  |                                                                                                                                                                                 |
| `index`        | integer               | **Yes**  |                                                                                                                                                                                 |
| `name`         | string                | **Yes**  |                                                                                                                                                                                 |
| `skipUrlSync`  | boolean               | **Yes**  |                                                                                                                                                                                 |
| `state`        | string                | **Yes**  | Possible values are: `NotStarted`, `Loading`, `Streaming`, `Done`, `Error`.                                                                                                     |
| `type`         | string                | **Yes**  | FROM: packages/grafana-data/src/types/templateVars.ts                                                                                                                           |
|                |                       |          | TODO docs                                                                                                                                                                       |
|                |                       |          | TODO this implies some wider pattern/discriminated union, probably? Possible values are: `query`, `adhoc`, `constant`, `datasource`, `interval`, `textbox`, `custom`, `system`. |
| `datasource`   | [object](#datasource) | No       | Ref to a DataSource instance                                                                                                                                                    |
| `description`  | string                | No       |                                                                                                                                                                                 |
| `error`        | [object](#error)      | No       |                                                                                                                                                                                 |
| `label`        | string                | No       |                                                                                                                                                                                 |
| `query`        |                       | No       | TODO: Move this into a separated QueryVariableModel type                                                                                                                        |
| `rootStateKey` | string                | No       |                                                                                                                                                                                 |

#### datasource

Ref to a DataSource instance

##### Properties

| Property | Type   | Required | Description                  |
| -------- | ------ | -------- | ---------------------------- |
| `type`   | string | No       | The plugin type-id           |
| `uid`    | string | No       | Specific datasource instance |

#### error

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |

## time

Time range for dashboard, e.g. last 6 hours, last 7 days, etc

### Properties

| Property | Type   | Required | Description |
| -------- | ------ | -------- | ----------- |
| `from`   | string | **Yes**  |             |
| `to`     | string | **Yes**  |             |

## timepicker

TODO docs
TODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes

### Properties

| Property            | Type     | Required | Description                             |
| ------------------- | -------- | -------- | --------------------------------------- |
| `collapse`          | boolean  | **Yes**  | Whether timepicker is collapsed or not. |
| `enable`            | boolean  | **Yes**  | Whether timepicker is enabled or not.   |
| `hidden`            | boolean  | **Yes**  | Whether timepicker is visible or not.   |
| `refresh_intervals` | string[] | **Yes**  | Selectable intervals for auto-refresh.  |
| `time_options`      | string[] | **Yes**  | TODO docs                               |
