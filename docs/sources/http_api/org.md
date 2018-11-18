+++
title = "Organisation HTTP API "
description = "Grafana Organisation HTTP API"
keywords = ["grafana", "http", "documentation", "api", "organisation"]
aliases = ["/http_api/organisation/"]
type = "docs"
[menu.docs]
name = "Organisation"
parent = "http_api"
+++


# Organisation API

The Organisation HTTP API is divided in two resources, `/api/org` (current organisation)
and `/api/orgs` (admin organisations). One big difference between these are that
the admin of all organisations API only works with basic authentication, see [Admin Organisations API](#admin-organisations-api) for more information.

## Current Organisation API

### Get current Organisation

`GET /api/org/`

**Example Request**:

```http
GET /api/org/ HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id":1,
  "name":"Main Org."
}
```

### Get all users within the current organisation

`GET /api/org/users`

**Example Request**:

```http
GET /api/org/users HTTP/1.1
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
    "orgId":1,
    "userId":1,
    "email":"admin@mygraf.com",
    "login":"admin",
    "role":"Admin"
  }
]
```

### Updates the given user

`PATCH /api/org/users/:userId`

**Example Request**:

```http
PATCH /api/org/users/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "role": "Viewer",
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Organization user updated"}
```

### Delete user in current organisation

`DELETE /api/org/users/:userId`

**Example Request**:

```http
DELETE /api/org/users/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"User removed from organization"}
```

### Update current Organisation

`PUT /api/org`

**Example Request**:

```http
PUT /api/org HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "name":"Main Org."
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Organization updated"}
```

### Add a new user to the current organisation

`POST /api/org/users`

Adds a global user to the current organisation.

**Example Request**:

```http
POST /api/org/users HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "role": "Admin",
  "loginOrEmail": "admin"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"User added to organization"}
```

## Admin Organisations API

The Admin Organisations HTTP API does not currently work with an API Token. API Tokens are currently
only linked to an organization and an organization role. They cannot be given the permission of server
admin, only users can be given that permission. So in order to use these API calls you will have to
use Basic Auth and the Grafana user must have the Grafana Admin permission (The default admin user
is called `admin` and has permission to use this API).

### Get Organisation by Id

`GET /api/orgs/:orgId`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
GET /api/orgs/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id":1,
  "name":"Main Org.",
  "address":{
    "address1":"",
    "address2":"",
    "city":"",
    "zipCode":"",
    "state":"",
    "country":""
  }
}
```
### Get Organisation by Name

`GET /api/orgs/name/:orgName`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
GET /api/orgs/name/Main%20Org%2E HTTP/1.1
Accept: application/json
Content-Type: application/json
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id":1,
  "name":"Main Org.",
  "address":{
    "address1":"",
    "address2":"",
    "city":"",
    "zipCode":"",
    "state":"",
    "country":""
  }
}
```

### Create Organisation

`POST /api/orgs`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
POST /api/orgs HTTP/1.1
Accept: application/json
Content-Type: application/json

{
  "name":"New Org."
}
```
Note: The api will work in the following two ways
1) Need to set GF_USERS_ALLOW_ORG_CREATE=true
2) Set the config users.allow_org_create to true in ini file

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "orgId":"1",
  "message":"Organization created"
}
```

### Search all Organisations

`GET /api/orgs`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
GET /api/orgs HTTP/1.1
Accept: application/json
Content-Type: application/json
```
Note: The api will only work when you pass the admin name and password
to the request http url, like http://admin:admin@localhost:3000/api/orgs

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id":1,
    "name":"Main Org."
  }
]
```

### Update Organisation

`PUT /api/orgs/:orgId`

Update Organisation, fields *Address 1*, *Address 2*, *City* are not implemented yet.
Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
PUT /api/orgs/1 HTTP/1.1
Accept: application/json
Content-Type: application/json

{
  "name":"Main Org 2."
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Organization updated"}
```

### Delete Organisation

`DELETE /api/orgs/:orgId`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
DELETE /api/orgs/1 HTTP/1.1
Accept: application/json
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Organization deleted"}
```

### Get Users in Organisation

`GET /api/orgs/:orgId/users`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
GET /api/orgs/1/users HTTP/1.1
Accept: application/json
Content-Type: application/json
```
Note: The api will only work when you pass the admin name and password
to the request http url, like http://admin:admin@localhost:3000/api/orgs/1/users


**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "orgId":1,
    "userId":1,
    "email":"admin@mygraf.com",
    "login":"admin",
    "role":"Admin"
  }
]
```

### Add User in Organisation

`POST /api/orgs/:orgId/users`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
POST /api/orgs/1/users HTTP/1.1
Accept: application/json
Content-Type: application/json

{
  "loginOrEmail":"user",
  "role":"Viewer"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"User added to organization"}
```

### Update Users in Organisation

`PATCH /api/orgs/:orgId/users/:userId`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
PATCH /api/orgs/1/users/2 HTTP/1.1
Accept: application/json
Content-Type: application/json

{
  "role":"Admin"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Organization user updated"}
```

### Delete User in Organisation

`DELETE /api/orgs/:orgId/users/:userId`

Only works with Basic Authentication (username and password), see [introduction](#admin-organisations-api).

**Example Request**:

```http
DELETE /api/orgs/1/users/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"User removed from organization"}
```
