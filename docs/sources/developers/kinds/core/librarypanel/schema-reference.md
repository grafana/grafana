---
keywords:
  - grafana
  - schema
title: LibraryPanel kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# LibraryPanel kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property        | Type                                            | Required | Description                                                                                                                          |
|-----------------|-------------------------------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------|
| `model`         | [object](#model)                                | **Yes**  | TODO: should be the same panel schema defined in dashboard<br/>Typescript: Omit<Panel, 'gridPos' &#124; 'id' &#124; 'libraryPanel'>; |
| `name`          | string                                          | **Yes**  | Panel name (also saved in the model)                                                                                                 |
| `type`          | string                                          | **Yes**  | The panel type (from inside the model)                                                                                               |
| `uid`           | string                                          | **Yes**  | Library element UID                                                                                                                  |
| `version`       | integer                                         | **Yes**  | panel version, incremented each time the dashboard is updated.                                                                       |
| `description`   | string                                          | No       | Panel description                                                                                                                    |
| `folderUid`     | string                                          | No       | Folder UID                                                                                                                           |
| `meta`          | [LibraryElementDTOMeta](#libraryelementdtometa) | No       |                                                                                                                                      |
| `schemaVersion` | integer                                         | No       | Dashboard version when this was saved (zero if unknown)                                                                              |

## LibraryElementDTOMeta

### Properties

| Property              | Type                                                    | Required | Description |
|-----------------------|---------------------------------------------------------|----------|-------------|
| `connectedDashboards` | integer                                                 | **Yes**  |             |
| `createdBy`           | [LibraryElementDTOMetaUser](#libraryelementdtometauser) | **Yes**  |             |
| `created`             | string                                                  | **Yes**  |             |
| `folderName`          | string                                                  | **Yes**  |             |
| `folderUid`           | string                                                  | **Yes**  |             |
| `updatedBy`           | [LibraryElementDTOMetaUser](#libraryelementdtometauser) | **Yes**  |             |
| `updated`             | string                                                  | **Yes**  |             |

### LibraryElementDTOMetaUser

#### Properties

| Property    | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `avatarUrl` | string  | **Yes**  |             |
| `id`        | integer | **Yes**  |             |
| `name`      | string  | **Yes**  |             |

### LibraryElementDTOMetaUser

#### Properties

| Property    | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `avatarUrl` | string  | **Yes**  |             |
| `id`        | integer | **Yes**  |             |
| `name`      | string  | **Yes**  |             |

## model

TODO: should be the same panel schema defined in dashboard
Typescript: Omit<Panel, 'gridPos' | 'id' | 'libraryPanel'>;

| Property | Type | Required | Description |
|----------|------|----------|-------------|


