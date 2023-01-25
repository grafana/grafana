---
keywords:
  - grafana
  - schema
title: User kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# User kind

## Maturity: merged
## Version: 0.0

## Properties

| Property         | Type                     | Required | Description                                                                                                                                 |
|------------------|--------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `created`        | integer                  | **Yes**  | Created indicates when the user was created.                                                                                                |
| `email`          |                          | **Yes**  | The email address associated with the user. Does not<br/>necessarily hold an email address.                                                 |
| `isDisabled`     | boolean                  | **Yes**  | Disabled users are unable to log in. Default: `false`.                                                                                      |
| `isExternal`     | boolean                  | **Yes**  | External users are authenticated through an external<br/>source of authentication. Default: `false`.                                        |
| `isGrafanaAdmin` | boolean                  | **Yes**  | Whether the user has the Grafana Admin flag set to grant<br/>additional permissions for managing the instance. Default: `false`.            |
| `login`          |                          | **Yes**  | The username that can be used to log in the user and can be<br/>used to distinguish between two equal names. Unique within<br/>an instance. |
| `name`           | string                   | **Yes**  | Display name, for showing in lists to end users.                                                                                            |
| `updated`        | integer                  | **Yes**  | Updated indicates when the user was most recently updated.                                                                                  |
| `accessControl`  | [object](#accesscontrol) | No       | Access control metadata associated with the user.                                                                                           |
| `authLabels`     | string[]                 | No       | For external users, this contains the type of the<br/>authentication provider used to authenticate the user.                                |
| `avatarUrl`      | string                   | No       | The Gravatar URL associated with the user's email.                                                                                          |
| `id`             | integer                  | No       | Numeric instance unique numeric identifier.                                                                                                 |
| `orgId`          | integer                  | No       | The currently active organization for the given user.                                                                                       |
| `theme`          | string                   | No       | User-specific theme preference. Possible values are: `dark`, `light`.                                                                       |

## accessControl

Access control metadata associated with the user.

| Property | Type | Required | Description |
|----------|------|----------|-------------|


