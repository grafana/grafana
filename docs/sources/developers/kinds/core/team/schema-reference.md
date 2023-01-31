---
keywords:
  - grafana
  - schema
title: Team kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# Team kind

## Maturity: merged
## Version: 0.0

## Properties

| Property        | Type                     | Required | Description                                              |
|-----------------|--------------------------|----------|----------------------------------------------------------|
| `created`       | integer                  | **Yes**  | Created indicates when the team was created.             |
| `memberCount`   | integer                  | **Yes**  | MemberCount is the number of the team members.           |
| `name`          | string                   | **Yes**  | Name of the team.                                        |
| `orgId`         | integer                  | **Yes**  | OrgId is the ID of an organisation the team belongs to.  |
| `permission`    | integer                  | **Yes**  | Possible values are: `0`, `1`, `2`, `4`.                 |
| `updated`       | integer                  | **Yes**  | Updated indicates when the team was updated.             |
| `accessControl` | [object](#accesscontrol) | No       | AccessControl metadata associated with a given resource. |
| `avatarUrl`     | string                   | No       | AvatarUrl is the team's avatar URL.                      |
| `email`         | string                   | No       | Email of the team.                                       |

## accessControl

AccessControl metadata associated with a given resource.

| Property | Type | Required | Description |
|----------|------|----------|-------------|


