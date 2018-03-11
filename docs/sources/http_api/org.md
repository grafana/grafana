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

## Get current Organisation

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

## Get Organisation by Id

`GET /api/orgs/:orgId`

**Example Request**:

```http
GET /api/orgs/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```
Note: The api will only work when you pass the admin name and password
to the request http url, like http://admin:admin@localhost:3000/api/orgs/1

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
## Get Organisation by Name

`GET /api/orgs/name/:orgName`

**Example Request**:

```http
GET /api/orgs/name/Main%20Org%2E HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```
Note: The api will only work when you pass the admin name and password
to the request http url, like http://admin:admin@localhost:3000/api/orgs/name/Main%20Org%2E

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

## Create Organisation

`POST /api/orgs`

**Example Request**:

```http
POST /api/orgs HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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


## Update current Organisation

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

## Get all users within the actual organisation

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

## Add a new user to the actual organisation

`POST /api/org/users`

Adds a global user to the actual organisation.

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

## Updates the given user

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

## Delete user in actual organisation

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

# Organisations

## Search all Organisations

`GET /api/orgs`

**Example Request**:

```http
GET /api/orgs HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
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

## Update Organisation

`PUT /api/orgs/:orgId`

Update Organisation, fields *Adress 1*, *Adress 2*, *City* are not implemented yet.

**Example Request**:

```http
PUT /api/orgs/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

## Get Users in Organisation

`GET /api/orgs/:orgId/users`

**Example Request**:

```http
GET /api/orgs/1/users HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
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

## Add User in Organisation

`POST /api/orgs/:orgId/users`

**Example Request**:

```http
POST /api/orgs/1/users HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

## Update Users in Organisation

`PATCH /api/orgs/:orgId/users/:userId`

**Example Request**:

```http
PATCH /api/orgs/1/users/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

## Delete User in Organisation

`DELETE /api/orgs/:orgId/users/:userId`

**Example Request**:

```http
DELETE /api/orgs/1/users/2 HTTP/1.1
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