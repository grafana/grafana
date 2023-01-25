---
keywords:
  - grafana
  - schema
title: Serviceaccount kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# Serviceaccount kind

## Maturity: merged
## Version: 0.0

## Properties

| Property        | Type                     | Required | Description                                                                                                                             |
|-----------------|--------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `avatarUrl`     | string                   | **Yes**  | AvatarUrl is the service account's avatar URL. It allows the frontend to display a picture in front<br/>of the service account.         |
| `created`       | integer                  | **Yes**  | Created indicates when the service account was created.                                                                                 |
| `id`            | integer                  | **Yes**  | ID is the unique identifier of the service account in the database.                                                                     |
| `isDisabled`    | boolean                  | **Yes**  | IsDisabled indicates if the service account is disabled.                                                                                |
| `login`         | string                   | **Yes**  | Login of the service account.                                                                                                           |
| `name`          | string                   | **Yes**  | Name of the service account.                                                                                                            |
| `orgID`         | integer                  | **Yes**  | OrgID is the ID of an organisation the service account belongs to.                                                                      |
| `role`          | string                   | **Yes**  | OrgRole is a Grafana Organization Role which can be 'Viewer', 'Editor', 'Admin'. Possible values are: `Admin`, `Editor`, `Viewer`.      |
| `teams`         | string[]                 | **Yes**  | Teams is a list of teams the service account belongs to.                                                                                |
| `tokens`        | integer                  | **Yes**  | Tokens is the number of active tokens for the service account.<br/>Tokens are used to authenticate the service account against Grafana. |
| `updated`       | integer                  | **Yes**  | Updated indicates when the service account was updated.                                                                                 |
| `accessControl` | [object](#accesscontrol) | No       | AccessControl metadata associated with a given resource.                                                                                |

## accessControl

AccessControl metadata associated with a given resource.

| Property | Type | Required | Description |
|----------|------|----------|-------------|


