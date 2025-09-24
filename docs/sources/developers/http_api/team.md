---
aliases:
  - ../../http_api/team/
canonical: /docs/grafana/latest/developers/http_api/team/
description: Grafana Team HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - team
  - teams
  - group
labels:
  products:
    - enterprise
    - oss
title: Team HTTP API
---

# Team API

This API can be used to manage Teams and Team Memberships.

Access to these API endpoints is restricted as follows:

- All authenticated users are able to view details of teams they are a member of.
- Organization Admins are able to manage all teams and team members.

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

## Team Search With Paging

`GET /api/teams/search?perpage=50&page=1&query=myteam&sort=memberCount-desc`

or

`GET /api/teams/search?name=myteam`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action     | Scope    |
| ---------- | -------- |
| teams:read | teams:\* |

**Example Request**:

```http
GET /api/teams/search?perpage=10&page=1&query=mytestteam HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "totalCount": 1,
  "teams": [
    {
      "id": 1,
      "orgId": 1,
      "name": "MyTestTeam",
      "email": "",
      "avatarUrl": "\/avatar\/3f49c15916554246daa714b9bd0ee398",
      "memberCount": 1
    }
  ],
  "page": 1,
  "perPage": 1000
}
```

### Using the query parameter

Default value for the `perpage` parameter is `1000` and for the `page` parameter is `1`.

The `totalCount` field in the response can be used for pagination of the teams list E.g. if `totalCount` is equal to 100 teams and the `perpage` parameter is set to 10 then there are 10 pages of teams.

The `query` parameter is optional and it will return results where the query value is contained in the `name` field. Query values with spaces need to be URL encoded e.g. `query=my%20team`.

The `sort` param is an optional comma separated list of options to order the search result. Accepted values for the sort filter are: ` name-asc`, `name-desc`, `email-asc`, `email-desc`, `memberCount-asc`, `memberCount-desc`. By default, if `sort` is not specified, the teams list will be ordered by `name` in ascending order.

### Using the name parameter

The `name` parameter returns a single team if the parameter matches the `name` field.

#### Status Codes:

- **200** - Ok
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found (if searching by name)

## Get Team By Id

`GET /api/teams/:id`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action     | Scope    |
| ---------- | -------- |
| teams:read | teams:\* |

**Example Request**:

```http
GET /api/teams/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id": 1,
  "orgId": 1,
  "name": "MyTestTeam",
  "email": "",
  "created": "2017-12-15T10:40:45+01:00",
  "updated": "2017-12-15T10:40:45+01:00"
}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found

## Add Team

The Team `name` needs to be unique. `name` is required and `email` is optional.

`POST /api/teams`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action       | Scope |
| ------------ | ----- |
| teams:create | N/A   |

**Example Request**:

```http
POST /api/teams HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt

{
  "name": "MyTestTeam",
  "email": "email@test.com",
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Team created","teamId":2,"uid":"ceaulqadfoav4e"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **409** - Team name is taken

## Update Team

There are two fields that can be updated for a team: `name` and `email`.

`PUT /api/teams/:id`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action      | Scope    |
| ----------- | -------- |
| teams:write | teams:\* |

**Example Request**:

```http
PUT /api/teams/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt

{
  "name": "MyTestTeam",
  "email": "email@test.com"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Team updated"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found
- **409** - Team name is taken

## Delete Team By Id

`DELETE /api/teams/:id`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action       | Scope    |
| ------------ | -------- |
| teams:delete | teams:\* |

**Example Request**:

```http
DELETE /api/teams/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Team deleted"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Failed to delete Team. ID not found

## Get Team Members

`GET /api/teams/:teamId/members`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action                 | Scope    |
| ---------------------- | -------- |
| teams.permissions:read | teams:\* |

**Example Request**:

```http
GET /api/teams/1/members HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "orgId": 1,
    "teamId": 1,
    "userId": 3,
    "email": "user1@email.com",
    "login": "user1",
    "avatarUrl": "\/avatar\/1b3c32f6386b0185c40d359cdc733a79"
  },
  {
    "orgId": 1,
    "teamId": 1,
    "userId": 2,
    "email": "user2@email.com",
    "login": "user2",
    "avatarUrl": "\/avatar\/cad3c68da76e45d10269e8ef02f8e73e"
  }
]
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied

## Add Team Member

`POST /api/teams/:teamId/members`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action                  | Scope    |
| ----------------------- | -------- |
| teams.permissions:write | teams:\* |

**Example Request**:

```http
POST /api/teams/1/members HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt

{
  "userId": 2
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Member added to Team"}
```

Status Codes:

- **200** - Ok
- **400** - User is already added to this team
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found

## Remove Member From Team

`DELETE /api/teams/:teamId/members/:userId`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action                  | Scope    |
| ----------------------- | -------- |
| teams.permissions:write | teams:\* |

**Example Request**:

```http
DELETE /api/teams/2/members/3 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Team Member removed"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found/Team member not found

## Bulk Update Team Members

Allows bulk updating team members and administrators using user emails.
Will override all current members and administrators for the specified team.

`PUT /api/teams/:teamId/members

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action                  | Scope    |
| ----------------------- | -------- |
| teams.permissions:write | teams:\* |

**Example Request**:

```http
PUT /api/teams/1/members HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer glsa_kcVxDhZtu5ISOZIEt

{
  "members": ["user1@email.com", "user2@email.com"]
  "admins": ["user3@email.com"]
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Team memberships have been updated"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Permission denied
- **404** - Team not found/Team member not found
- **500** - Internal error

## Get Team Preferences

`GET /api/teams/:teamId/preferences`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action     | Scope    |
| ---------- | -------- |
| teams:read | teams:\* |

**Example Request**:

```http
GET /api/teams/2/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "theme": "",
  "homeDashboardId": 0,
  "homeDashboardUID": "",
  "timezone": ""
}
```

## Update Team Preferences

`PUT /api/teams/:teamId/preferences`

**Required permissions**

See note in the [introduction](#team-api) for an explanation.

| Action      | Scope    |
| ----------- | -------- |
| teams:write | teams:\* |

**Example Request**:

```http
PUT /api/teams/2/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "theme": "dark",
  "homeDashboardId": 39,
  "homeDashboardUID": "jcIIG-07z",
  "timezone": "utc"
}
```

JSON Body Schema:

- **theme** - One of: `light`, `dark`, or an empty string for the default theme
- **homeDashboardId** - Deprecated. Use `homeDashboardUID` instead.
- **homeDashboardUID** - The `:uid` of a dashboard
- **timezone** - One of: `utc`, `browser`, or an empty string for the default

Omitting a key will cause the current value to be replaced with the system default value.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: text/plain; charset=utf-8

{
  "message":"Preferences updated"
}
```
