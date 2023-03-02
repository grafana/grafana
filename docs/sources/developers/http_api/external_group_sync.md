---
aliases:
  - ../../http_api/external_group_sync/
canonical: /docs/grafana/latest/developers/http_api/external_group_sync/
description: Grafana External Group Sync HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - team
  - teams
  - group
  - member
  - enterprise
title: External Group Sync HTTP API
---

# External Group Synchronization API

> External Group Synchronization is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}).

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions]({{< relref "../../administration/roles-and-permissions/access-control/custom-role-actions-scopes/" >}}) for more information.

## Get External Groups

`GET /api/teams/:teamId/groups`

**Required permissions**

See note in the [introduction]({{< ref "#external-group-synchronization-api" >}}) for an explanation.

| Action                 | Scope    |
| ---------------------- | -------- |
| teams.permissions:read | teams:\* |

**Example Request**:

```http
GET /api/teams/1/groups HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "orgId": 1,
    "teamId": 1,
    "groupId": "cn=editors,ou=groups,dc=grafana,dc=org"
  }
]
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied

## Add External Group

`POST /api/teams/:teamId/groups`

**Required permissions**

See note in the [introduction]({{< ref "#external-group-synchronization-api" >}}) for an explanation.

| Action                  | Scope    |
| ----------------------- | -------- |
| teams.permissions:write | teams:\* |

**Example Request**:

```http
POST /api/teams/1/members HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=

{
  "groupId": "cn=editors,ou=groups,dc=grafana,dc=org"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Group added to Team"}
```

Status Codes:

- **200** - Ok
- **400** - Group is already added to this team
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found

## Remove External Group

`DELETE /api/teams/:teamId/groups/:groupId`

**Required permissions**

See note in the [introduction]({{< ref "#external-group-synchronization-api" >}}) for an explanation.

| Action                  | Scope    |
| ----------------------- | -------- |
| teams.permissions:write | teams:\* |

**Example Request**:

```http
DELETE /api/teams/1/groups/cn=editors,ou=groups,dc=grafana,dc=org HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Team Group removed"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found/Group not found
