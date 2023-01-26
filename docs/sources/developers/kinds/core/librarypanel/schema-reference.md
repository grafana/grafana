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

| Property        | Type                                            | Required | Description                                                       |
|-----------------|-------------------------------------------------|----------|-------------------------------------------------------------------|
| `description`   | string                                          | **Yes**  | Panel description (ideally optional, but avoid pointer issues)    |
| `folderId`      | integer                                         | **Yes**  | TODO -- remove... do not expose internal ID                       |
| `folderUid`     | string                                          | **Yes**  | Folder UID                                                        |
| `id`            | integer                                         | **Yes**  | TODO: remove, should not be externally defined                    |
| `kind`          | integer                                         | **Yes**  | TODO, remove?  always 1                                           |
| `model`         |                                                 | **Yes**  | TODO: this should the same panel type as defined inside dashboard |
| `name`          | string                                          | **Yes**  | Panel name (also saved in the model)                              |
| `orgId`         | integer                                         | **Yes**  | TODO: remove, should not be externally defined                    |
| `schemaVersion` | integer                                         | **Yes**  | Dashboard version when this was saved Default: `36`.              |
| `type`          | string                                          | **Yes**  | The panel type (from inside the model)                            |
| `uid`           | string                                          | **Yes**  | Library element UID                                               |
| `version`       | integer                                         | **Yes**  | panel version, incremented each time the dashboard is updated.    |
| `meta`          | [LibraryElementDTOMeta](#libraryelementdtometa) | No       |                                                                   |

## LibraryElementDTOMeta

### Properties

| Property              | Type                                                    | Required | Description |
|-----------------------|---------------------------------------------------------|----------|-------------|
| `connectedDashboards` | integer                                                 | **Yes**  |             |
| `createdBy`           | [LibraryElementDTOMetaUser](#libraryelementdtometauser) | **Yes**  |             |
| `created`             | integer                                                 | **Yes**  |             |
| `folderName`          | string                                                  | **Yes**  |             |
| `folderUid`           | string                                                  | **Yes**  |             |
| `updatedBy`           | [LibraryElementDTOMetaUser](#libraryelementdtometauser) | **Yes**  |             |
| `updated`             | integer                                                 | **Yes**  |             |

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


