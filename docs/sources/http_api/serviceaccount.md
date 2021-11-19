+++
title = "Service account HTTP API"
description = "Grafana Service account HTTP API"
keywords = ["grafana", "http", "documentation", "api", "serviceaccount"]
aliases = ["/docs/grafana/latest/http_api/serviceaccount/"]
+++

# Service account API

> If you are running Grafana Enterprise and have [Fine-grained access control]({{< relref "../enterprise/access-control/_index.md" >}}) enabled, for some endpoints you would need to have relevant permissions.
> Refer to specific resources to understand what permissions are required.

```zsh
curl --request POST \
  --url http://admin:admin@localhost:3000/api/auth/keys \
  --header 'Content-Type: application/json' \
  --data '{
	"name": "apikeycurl8",
	"role": "Admin",
	"createServiceAccount": true
}'
```

## Search Service accounts

`GET /api/serviceaccounts?perpage=10&page=1`

#### Required permissions

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action     | Scope           |
| ---------- | --------------- |
| users:read | global:users:\* |

**Example Request**:

```http
GET /api/users HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

Default value for the `perpage` parameter is `1000` and for the `page` parameter is `1`. Requires basic authentication and that the authenticated user is a Grafana Admin.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id": 1,
    "name": "Admin",
    "login": "admin",
    "email": "admin@mygraf.com",
    "isAdmin": true,
    "isDisabled": false,
    "lastSeenAt": "2020-04-10T20:29:27+03:00",
    "lastSeenAtAge': "2m",
    "authLabels": ["OAuth"]
  },
  {
    "id": 2,
    "name": "User",
    "login": "user",
    "email": "user@mygraf.com",
    "isAdmin": false,
    "isDisabled": false,
    "lastSeenAt": "2020-01-24T12:38:47+02:00",
    "lastSeenAtAge": "2M",
    "authLabels": []
  }
]
```

## Delete a service account

`DELETE /api/serviceaccount/:serviceaccountId`

Deletes the starring of the given Dashboard for the actual user.

**Example Request**:

```http
DELETE /api/user/stars/dashboard/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Dashboard unstarred"}
```

## Auth tokens of the actual User

`GET /api/user/auth-tokens`

Return a list of all auth tokens (devices) that the actual user currently have logged in from.

**Example Request**:

```http
GET /api/user/auth-tokens HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id": 361,
    "isActive": true,
    "clientIp": "127.0.0.1",
    "browser": "Chrome",
    "browserVersion": "72.0",
    "os": "Linux",
    "osVersion": "",
    "device": "Other",
    "createdAt": "2019-03-05T21:22:54+01:00",
    "seenAt": "2019-03-06T19:41:06+01:00"
  },
  {
    "id": 364,
    "isActive": false,
    "clientIp": "127.0.0.1",
    "browser": "Mobile Safari",
    "browserVersion": "11.0",
    "os": "iOS",
    "osVersion": "11.0",
    "device": "iPhone",
    "createdAt": "2019-03-06T19:41:19+01:00",
    "seenAt": "2019-03-06T19:41:21+01:00"
  }
]
```

## Revoke an auth token of the actual User

`POST /api/user/revoke-auth-token`

Revokes the given auth token (device) for the actual user. User of issued auth token (device) will no longer be logged in
and will be required to authenticate again upon next activity.

**Example Request**:

```http
POST /api/user/revoke-auth-token HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "authTokenId": 364
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "User auth token revoked"
}
```
