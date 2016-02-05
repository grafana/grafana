----
page_title: Organisation API
page_description: Grafana Organisation API Reference
page_keywords: grafana, admin, http, api, documentation, orgs, organisation
---

# Organisation API

## Get current Organisation

`GET /api/org`

**Example Request**:

    GET /api/org HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "id":1,
      "name":"Main Org."
    }

## Get Organisation by Id

`GET /api/orgs/:orgId`

**Example Request**:

    GET /api/orgs/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

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

## Get Organisation by Name

`GET /api/orgs/name/:orgName`

**Example Request**:

    GET /api/orgs/name/Main%20Org%2E HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

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

## Update current Organisation

`PUT /api/org`

**Example Request**:

    PUT /api/org HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "name":"Main Org."
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Organization updated"}


## Get all users within the actual organisation

`GET /api/org/users`

**Example Request**:

    GET /api/org/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

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

## Add a new user to the actual organisation

`POST /api/org/users`

Adds a global user to the actual organisation.

**Example Request**:

    POST /api/org/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "role": "Admin",
      "loginOrEmail": "admin"
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"User added to organization"}

## Updates the given user

`PATCH /api/org/users/:userId`

**Example Request**:

    PATCH /api/org/users/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "role": "Viewer",
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Organization user updated"}


## Delete user in actual organisation

`DELETE /api/org/users/:userId`

**Example Request**:

    DELETE /api/org/users/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"User removed from organization"}


# Organisations

## Search all Organisations

`GET /api/orgs`

**Example Request**:

    GET /api/orgs HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "id":1,
        "name":"Main Org."
      }
    ]

## Update Organisation

`PUT /api/orgs/:orgId`

Update Organisation, fields *Adress 1*, *Adress 2*, *City* are not implemented yet.

**Example Request**:

    PUT /api/orgs/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "name":"Main Org 2."
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Organization updated"}

## Get Users in Organisation

`GET /api/orgs/:orgId/users`

**Example Request**:

    GET /api/orgs/1/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

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

## Add User in Organisation

`POST /api/orgs/:orgId/users`

**Example Request**:

    POST /api/orgs/1/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "loginOrEmail":"user",
      "role":"Viewer"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"User added to organization"}

## Update Users in Organisation

`PATCH /api/orgs/:orgId/users/:userId`

**Example Request**:

    PATCH /api/orgs/1/users/2 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "role":"Admin"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Organization user updated"}

## Delete User in Organisation

`DELETE /api/orgs/:orgId/users/:userId`

**Example Request**:

    DELETE /api/orgs/1/users/2 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"User removed from organization"}
