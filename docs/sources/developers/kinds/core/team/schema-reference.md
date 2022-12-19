---
draft: true
keywords:
  - grafana
  - schema
title: Team kind
---

# Team kind

### Maturity: merged

### Version: 0.0

## Properties

| Property        | Type                     | Required | Description                                                                                                                   |
| --------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `accessControl` | [object](#accesscontrol) | **Yes**  | AccessControl metadata associated with a given resource.                                                                      |
| `created`       | integer                  | **Yes**  | Created indicates when the team was created.                                                                                  |
| `memberCount`   | integer                  | **Yes**  | MemberCount is the number of the team members.                                                                                |
| `name`          | string                   | **Yes**  | Name of the team.                                                                                                             |
| `orgId`         | integer                  | **Yes**  | OrgId is the ID of an organisation the team belongs to.                                                                       |
| `permission`    | integer                  | **Yes**  | TODO - it seems it's a team_member.permission, unlikely it should belong to the team kind Possible values are: `1`, `2`, `4`. |
| `updated`       | integer                  | **Yes**  | Updated indicates when the team was updated.                                                                                  |
| `avatarUrl`     | string                   | No       | AvatarUrl is the team's avatar URL.                                                                                           |
| `email`         | string                   | No       | Email of the team.                                                                                                            |

## accessControl

AccessControl metadata associated with a given resource.

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
