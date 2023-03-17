---
keywords:
  - grafana
  - schema
title: LibraryPanel kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## LibraryPanel

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0

A standalone panel

| Property | Type            | Required | Description |
|----------|-----------------|----------|-------------|
| `spec`   | [object](#spec) | **Yes**  |             |

### Spec

| Property        | Type                                                        | Required | Description                                                                                                                          |
|-----------------|-------------------------------------------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------|
| `model`         | [object](#model)                                            | **Yes**  | TODO: should be the same panel schema defined in dashboard<br/>Typescript: Omit<Panel, 'gridPos' &#124; 'id' &#124; 'libraryPanel'>; |
| `name`          | string                                                      | **Yes**  | Panel name (also saved in the model)<br/>Constraint: `length >=1`.                                                                   |
| `type`          | string                                                      | **Yes**  | The panel type (from inside the model)<br/>Constraint: `length >=1`.                                                                 |
| `uid`           | string                                                      | **Yes**  | Library element UID                                                                                                                  |
| `version`       | integer                                                     | **Yes**  | panel version, incremented each time the dashboard is updated.                                                                       |
| `description`   | string                                                      | No       | Panel description                                                                                                                    |
| `folderUid`     | string                                                      | No       | Folder UID                                                                                                                           |
| `meta`          | [spec.#LibraryElementDTOMeta](#spec.#libraryelementdtometa) | No       |                                                                                                                                      |
| `schemaVersion` | uint16                                                      | No       | Dashboard version when this was saved (zero if unknown)                                                                              |

### Model

TODO: should be the same panel schema defined in dashboard
Typescript: Omit<Panel, 'gridPos' | 'id' | 'libraryPanel'>;

| Property | Type | Required | Description |
|----------|------|----------|-------------|

### Spec.#LibraryElementDTOMeta

| Property              | Type                                                                | Required | Description |
|-----------------------|---------------------------------------------------------------------|----------|-------------|
| `connectedDashboards` | integer                                                             | **Yes**  |             |
| `createdBy`           | [spec.#LibraryElementDTOMetaUser](#spec.#libraryelementdtometauser) | **Yes**  |             |
| `created`             | string                                                              | **Yes**  |             |
| `folderName`          | string                                                              | **Yes**  |             |
| `folderUid`           | string                                                              | **Yes**  |             |
| `updatedBy`           | [spec.#LibraryElementDTOMetaUser](#spec.#libraryelementdtometauser) | **Yes**  |             |
| `updated`             | string                                                              | **Yes**  |             |

### Spec.#LibraryElementDTOMetaUser

| Property    | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `avatarUrl` | string  | **Yes**  |             |
| `id`        | integer | **Yes**  |             |
| `name`      | string  | **Yes**  |             |


