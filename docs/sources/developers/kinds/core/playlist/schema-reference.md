---
keywords:
  - grafana
  - schema
title: Playlist kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## Playlist

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

A playlist is a series of dashboards that is automatically rotated in the browser, on a configurable interval.

| Property   | Type                | Required | Default | Description                                                                                                                                                                                                                                                                    |
|------------|---------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `metadata` | [object](#metadata) | **Yes**  |         | metadata contains embedded CommonMetadata and can be extended with custom string fields<br/>TODO: use CommonMetadata instead of redefining here; currently needs to be defined here<br/>without external reference as using the CommonMetadata reference breaks thema codegen. |
| `spec`     | [object](#spec)     | **Yes**  |         |                                                                                                                                                                                                                                                                                |
| `status`   | [object](#status)   | **Yes**  |         |                                                                                                                                                                                                                                                                                |

### Metadata

metadata contains embedded CommonMetadata and can be extended with custom string fields
TODO: use CommonMetadata instead of redefining here; currently needs to be defined here
without external reference as using the CommonMetadata reference breaks thema codegen.

It extends [_kubeObjectMetadata](#_kubeobjectmetadata).

| Property            | Type                   | Required | Default | Description                                                                                                                             |
|---------------------|------------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `createdBy`         | string                 | **Yes**  |         |                                                                                                                                         |
| `creationTimestamp` | string                 | **Yes**  |         | *(Inherited from [_kubeObjectMetadata](#_kubeobjectmetadata))*                                                                          |
| `extraFields`       | [object](#extrafields) | **Yes**  |         | extraFields is reserved for any fields that are pulled from the API server metadata but do not have concrete fields in the CUE metadata |
| `finalizers`        | string[]               | **Yes**  |         | *(Inherited from [_kubeObjectMetadata](#_kubeobjectmetadata))*                                                                          |
| `labels`            | map[string]string      | **Yes**  |         | *(Inherited from [_kubeObjectMetadata](#_kubeobjectmetadata))*                                                                          |
| `resourceVersion`   | string                 | **Yes**  |         | *(Inherited from [_kubeObjectMetadata](#_kubeobjectmetadata))*                                                                          |
| `uid`               | string                 | **Yes**  |         | *(Inherited from [_kubeObjectMetadata](#_kubeobjectmetadata))*                                                                          |
| `updateTimestamp`   | string                 | **Yes**  |         |                                                                                                                                         |
| `updatedBy`         | string                 | **Yes**  |         |                                                                                                                                         |
| `deletionTimestamp` | string                 | No       |         | *(Inherited from [_kubeObjectMetadata](#_kubeobjectmetadata))*                                                                          |

### _kubeObjectMetadata

_kubeObjectMetadata is metadata found in a kubernetes object's metadata field.
It is not exhaustive and only includes fields which may be relevant to a kind's implementation,
As it is also intended to be generic enough to function with any API Server.

| Property            | Type              | Required | Default | Description |
|---------------------|-------------------|----------|---------|-------------|
| `creationTimestamp` | string            | **Yes**  |         |             |
| `finalizers`        | string[]          | **Yes**  |         |             |
| `labels`            | map[string]string | **Yes**  |         |             |
| `resourceVersion`   | string            | **Yes**  |         |             |
| `uid`               | string            | **Yes**  |         |             |
| `deletionTimestamp` | string            | No       |         |             |

### ExtraFields

extraFields is reserved for any fields that are pulled from the API server metadata but do not have concrete fields in the CUE metadata

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Spec

| Property   | Type                            | Required | Default | Description                                                                                                                                                          |
|------------|---------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `interval` | string                          | **Yes**  | `5m`    | Interval sets the time between switching views in a playlist.<br/>FIXME: Is this based on a standardized format or what options are available? Can datemath be used? |
| `name`     | string                          | **Yes**  |         | Name of the playlist.                                                                                                                                                |
| `uid`      | string                          | **Yes**  |         | Unique playlist identifier. Generated on creation, either by the<br/>creator of the playlist of by the application.                                                  |
| `items`    | [PlaylistItem](#playlistitem)[] | No       |         | The ordered list of items that the playlist will iterate over.<br/>FIXME! This should not be optional, but changing it makes the godegen awkward                     |

### PlaylistItem

| Property | Type   | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|----------|--------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`   | string | **Yes**  |         | Type of the item.<br/>Possible values are: `dashboard_by_uid`, `dashboard_by_id`, `dashboard_by_tag`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `value`  | string | **Yes**  |         | Value depends on type and describes the playlist item.<br/><br/> - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This<br/> is not portable as the numerical identifier is non-deterministic between different instances.<br/> Will be replaced by dashboard_by_uid in the future. (deprecated)<br/> - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All<br/> dashboards behind the tag will be added to the playlist.<br/> - dashboard_by_uid: The value is the dashboard UID |
| `title`  | string | No       |         | Title is an unused property -- it will be removed in the future                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Status

| Property           | Type                                                       | Required | Default | Description                                                                                                                                                                |
|--------------------|------------------------------------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `additionalFields` | [object](#additionalfields)                                | No       |         | additionalFields is reserved for future use                                                                                                                                |
| `operatorStates`   | map[string][status.#OperatorState](#status.#operatorstate) | No       |         | operatorStates is a map of operator ID to operator state evaluations.<br/>Any operator which consumes this kind SHOULD add its state evaluation information to this field. |

### AdditionalFields

additionalFields is reserved for future use

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Status.#OperatorState

| Property           | Type               | Required | Default | Description                                                                                                                                                                      |
|--------------------|--------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lastEvaluation`   | string             | **Yes**  |         | lastEvaluation is the ResourceVersion last evaluated                                                                                                                             |
| `state`            | string             | **Yes**  |         | state describes the state of the lastEvaluation.<br/>It is limited to three possible states for machine evaluation.<br/>Possible values are: `success`, `in_progress`, `failed`. |
| `descriptiveState` | string             | No       |         | descriptiveState is an optional more descriptive state field which has no requirements on format                                                                                 |
| `details`          | [object](#details) | No       |         | details contains any extra information that is operator-specific                                                                                                                 |

### Details

details contains any extra information that is operator-specific

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|


