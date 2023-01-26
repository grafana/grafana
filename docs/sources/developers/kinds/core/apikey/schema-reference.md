---
keywords:
  - grafana
  - schema
title: APIKey kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# APIKey kind

## Maturity: merged
## Version: 0.0

## Properties

| Property        | Type                     | Required | Description                                                                                                                        |
|-----------------|--------------------------|----------|------------------------------------------------------------------------------------------------------------------------------------|
| `id`            | integer                  | **Yes**  | ID is the unique identifier of the api key in the database.                                                                        |
| `name`          | string                   | **Yes**  | Name of the api key.                                                                                                               |
| `role`          | string                   | **Yes**  | OrgRole is a Grafana Organization Role which can be 'Viewer', 'Editor', 'Admin'. Possible values are: `Admin`, `Editor`, `Viewer`. |
| `accessControl` | [object](#accesscontrol) | No       | AccessControl metadata associated with a given resource.                                                                           |
| `expiration`    | integer                  | No       | Expiration indicates when the api key expires.                                                                                     |

## accessControl

AccessControl metadata associated with a given resource.

| Property | Type | Required | Description |
|----------|------|----------|-------------|


