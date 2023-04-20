---
keywords:
  - grafana
  - schema
title: ServiceAccount kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## ServiceAccount

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0

system account

| Property   | Type                | Required | Default | Description                                                                                                                                                                                                                                                                  |
|------------|---------------------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `metadata` | [object](#metadata) | **Yes**  |         | metadata contains embedded CommonMetadata and can be extended with custom string fields<br/>TODO: use CommonMetadata instead of redfining here; currently needs to be defined here<br/>without extenal reference as using the CommonMetadata reference breaks thema codegen. |
| `spec`     | [object](#spec)     | **Yes**  |         |                                                                                                                                                                                                                                                                              |
| `status`   | [object](#status)   | **Yes**  |         |                                                                                                                                                                                                                                                                              |

### Metadata

metadata contains embedded CommonMetadata and can be extended with custom string fields
TODO: use CommonMetadata instead of redfining here; currently needs to be defined here
without extenal reference as using the CommonMetadata reference breaks thema codegen.

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

| Property        | Type               | Required | Default | Description                                                                                                                             |
|-----------------|--------------------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `avatarUrl`     | string             | **Yes**  |         | AvatarUrl is the service account's avatar URL. It allows the frontend to display a picture in front<br/>of the service account.         |
| `id`            | integer            | **Yes**  |         | ID is the unique identifier of the service account in the database.                                                                     |
| `isDisabled`    | boolean            | **Yes**  |         | IsDisabled indicates if the service account is disabled.                                                                                |
| `login`         | string             | **Yes**  |         | Login of the service account.                                                                                                           |
| `name`          | string             | **Yes**  |         | Name of the service account.                                                                                                            |
| `orgId`         | integer            | **Yes**  |         | OrgId is the ID of an organisation the service account belongs to.                                                                      |
| `role`          | string             | **Yes**  |         | OrgRole is a Grafana Organization Role which can be 'Viewer', 'Editor', 'Admin'.<br/>Possible values are: `Admin`, `Editor`, `Viewer`.  |
| `tokens`        | integer            | **Yes**  |         | Tokens is the number of active tokens for the service account.<br/>Tokens are used to authenticate the service account against Grafana. |
| `accessControl` | map[string]boolean | No       |         | AccessControl metadata associated with a given resource.                                                                                |
| `created`       | string             | No       |         | Created indicates when the service account was created.                                                                                 |
| `teams`         | string[]           | No       |         | Teams is a list of teams the service account belongs to.                                                                                |
| `updated`       | string             | No       |         | Updated indicates when the service account was updated.                                                                                 |

### Status

| Property           | Type                                                                             | Required | Default | Description                                                                                                                                                                |
|--------------------|----------------------------------------------------------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `additionalFields` | [object](#additionalfields)                                                      | **Yes**  |         | additionalFields is reserved for future use                                                                                                                                |
| `operatorStates`   | map[string][joinSchema.status.#OperatorState](#joinschema.status.#operatorstate) | No       |         | operatorStates is a map of operator ID to operator state evaluations.<br/>Any operator which consumes this kind SHOULD add its state evaluation information to this field. |

### AdditionalFields

additionalFields is reserved for future use

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### JoinSchema.Status.#OperatorState

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


