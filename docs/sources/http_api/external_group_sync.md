+++
title = "External Group Sync HTTP API "
description = "Grafana External Group Sync HTTP API"
keywords = ["grafana", "http", "documentation", "api", "team", "teams", "group", "member", "enterprise"]
aliases = ["/docs/grafana/latest/http_api/external_group_sync/"]
type = "docs"
[menu.docs]
name = "External Group Sync"
parent = "http_api"
+++

# External Group Synchronization API

> External Group Synchronization is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "../enterprise" >}}).

## Get External Groups

`GET /api/teams/:teamId/groups`

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
