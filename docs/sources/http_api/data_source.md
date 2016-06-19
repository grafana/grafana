----
page_title: Data source API
page_description: Grafana Data source API Reference
page_keywords: grafana, admin, http, api, documentation, datasource
---

# Data source API

## Get all datasources

`GET /api/datasources`

**Example Request**:

    GET /api/datasources HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "id":1,
        "orgId":1,
        "name":"datasource_elastic",
        "type":"elasticsearch",
        "access":"proxy",
        "url":"http://mydatasource.com",
        "password":"",
        "user":"",
        "database":"grafana-dash",
        "basicAuth":false,
        "basicAuthUser":"",
        "basicAuthPassword":"",
        "isDefault":false,
        "jsonData":null
      }
    ]

## Get a single data sources by Id

`GET /api/datasources/:datasourceId`

**Example Request**:

    GET /api/datasources/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "id":1,
      "orgId":1,
      "name":"test_datasource",
      "type":"graphite",
      "access":"proxy",
      "url":"http://mydatasource.com",
      "password":"",
      "user":"",
      "database":"",
      "basicAuth":false,
      "basicAuthUser":"",
      "basicAuthPassword":"",
      "isDefault":false,
      "jsonData":null
    }

## Get a single data source by Name

`GET /api/datasources/name/:name`

**Example Request**:

    GET /api/datasources/name/test_datasource HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "id":1,
      "orgId":1,
      "name":"test_datasource",
      "type":"graphite",
      "access":"proxy",
      "url":"http://mydatasource.com",
      "password":"",
      "user":"",
      "database":"",
      "basicAuth":false,
      "basicAuthUser":"",
      "basicAuthPassword":"",
      "isDefault":false,
      "jsonData":null
    }

## Get data source Id by Name

`GET /api/datasources/id/:name`

**Example Request**:

    GET /api/datasources/id/test_datasource HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "id":1
    }

## Create data source

`POST /api/datasources`

**Example Request**:

    POST /api/datasources HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "name":"test_datasource",
      "type":"graphite",
      "url":"http://mydatasource.com",
      "access":"proxy",
      "basicAuth":false
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"id":1,"message":"Datasource added"}

## Update an existing data source

`PUT /api/datasources/:datasourceId`

**Example Request**:

    PUT /api/datasources/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "id":1,
      "orgId":1,
      "name":"test_datasource",
      "type":"graphite",
      "access":"proxy",
      "url":"http://mydatasource.com",
      "password":"",
      "user":"",
      "database":"",
      "basicAuth":true,
      "basicAuthUser":"basicuser",
      "basicAuthPassword":"basicuser",
      "isDefault":false,
      "jsonData":null
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Datasource updated"}

## Delete an existing data source

`DELETE /api/datasources/:datasourceId`

**Example Request**:

    DELETE /api/datasources/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Data source deleted"}

## Data source proxy calls

`GET /api/datasources/proxy/:datasourceId/*`

Proxies all calls to the actual datasource.
