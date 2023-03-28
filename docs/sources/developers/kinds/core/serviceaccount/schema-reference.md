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

| Property        | Type               | Required | Description                                                                                                                             |
|-----------------|--------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `avatarUrl`     | string             | **Yes**  | AvatarUrl is the service account's avatar URL. It allows the frontend to display a picture in front<br/>of the service account.         |
| `id`            | integer            | **Yes**  | ID is the unique identifier of the service account in the database.                                                                     |
| `isDisabled`    | boolean            | **Yes**  | IsDisabled indicates if the service account is disabled.                                                                                |
| `login`         | string             | **Yes**  | Login of the service account.                                                                                                           |
| `name`          | string             | **Yes**  | Name of the service account.                                                                                                            |
| `orgId`         | integer            | **Yes**  | OrgId is the ID of an organisation the service account belongs to.                                                                      |
| `role`          | string             | **Yes**  | OrgRole is a Grafana Organization Role which can be 'Viewer', 'Editor', 'Admin'.<br/>Possible values are: `Admin`, `Editor`, `Viewer`.  |
| `tokens`        | integer            | **Yes**  | Tokens is the number of active tokens for the service account.<br/>Tokens are used to authenticate the service account against Grafana. |
| `accessControl` | map[string]boolean | No       | AccessControl metadata associated with a given resource.                                                                                |
| `created`       | integer            | No       | Created indicates when the service account was created.                                                                                 |
| `teams`         | string[]           | No       | Teams is a list of teams the service account belongs to.                                                                                |
| `updated`       | integer            | No       | Updated indicates when the service account was updated.                                                                                 |


