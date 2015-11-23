----
page_title: HTTP API
page_description: Grafana HTTP API Reference
page_keywords: grafana, admin, http, api, documentation
---

# HTTP API Reference

The Grafana backend exposes an HTTP API, the same API is used by the frontend to do everything from saving
dashboards, creating users and updating data sources.

## Authorization

### Tokens

Currently you can authenticate via an `API Token` or via a `Session cookie` (acquired using regular login or oauth).

### Basic Auth

If basic auth is enabled (it is enabled by default) you can authenticate your HTTP request via
standard basic auth.

curl example:
```
?curl http://admin:admin@localhost:3000/api/org
{"id":1,"name":"Main Org."}
```

### Create API Token

Open the sidemenu and click the organization dropdown and select the `API Keys` option.

![](/img/v2/orgdropdown_api_keys.png)

You use the token in all requests in the `Authorization` header, like this:

**Example**:

    GET http://your.grafana.com/api/dashboards/db/mydash HTTP/1.1
    Accept: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

The `Authorization` header value should be `Bearer <your api key>`.

## Dashboards

### Create / Update dashboard

`POST /api/dashboards/db`

Creates a new dashboard or updates an existing dashboard.

**Example Request for new dashboard**:

    POST /api/dashboards/db HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "dashboard": {
        "id": null,
        "title": "Production Overview",
        "tags": [ "templated" ],
        "timezone": "browser",
        "rows": [
          {
          }
        ],
        "schemaVersion": 6,
        "version": 0
      },
      "overwrite": false
    }

JSON Body schema:

- **dashboard** – The complete dashboard model, id = null to create a new dashboard
- **overwrite** – Set to true if you want to overwrite existing dashboard with newer version or with same dashboard title.

**Example Response**:

    HTTP/1.1 200 OK
    Content-Type: application/json; charset=UTF-8
    Content-Length: 78

    {
      "slug": "production-overview",
      "status": "success",
      "version": 1
    }

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **412** – Precondition failed

The **412** status code is used when a newer dashboard already exists (newer, its version is greater than the version that was sent). The
same status code is also used if another dashboard exists with the same title. The response body will look like this:

    HTTP/1.1 412 Precondition Failed
    Content-Type: application/json; charset=UTF-8
    Content-Length: 97

    {
      "message": "The dashboard has been changed by someone else",
      "status": "version-mismatch"
    }

In in case of title already exists the `status` property will be `name-exists`.

### Get dashboard

`GET /api/dashboards/db/:slug`

Will return the dashboard given the dashboard slug. Slug is the url friendly version of the dashboard title.

**Example Request**:

    GET /api/dashboards/db/production-overview HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "meta": {
        "isStarred": false,
        "slug": "production-overview"
      },
      "model": {
        "id": null,
        "title": "Production Overview",
        "tags": [ "templated" ],
        "timezone": "browser",
        "rows": [
          {
          }
        ]
        "schemaVersion": 6,
        "version": 0
      },
    }

### Delete dashboard

`DELETE /api/dashboards/db/:slug`

The above will delete the dashboard with the specified slug. The slug is the url friendly (unique) version of the dashboard title.

**Example Request**:

    DELETE /api/dashboards/db/test HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"title": "Test"}

### Gets the home dashboard

`GET /api/dashboards/home`

Will return the home dashboard.

**Example Request**:

    GET /api/dashboards/home HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "meta":	{
        "isHome":true,
        "canSave":false,
        "canEdit":false,
        "canStar":false,
        "slug":"",
        "expires":"0001-01-01T00:00:00Z",
        "created":"0001-01-01T00:00:00Z"
      },
      "dashboard": {
        "editable":false,
        "hideControls":true,
        "nav":[
        {
          "enable":false,
        "type":"timepicker"
        }
        ],
        "rows": [
          {

          }
        ],
        "style":"dark",
        "tags":[],
        "templating":{
          "list":[
          ]
        },
        "time":{
        },
        "timezone":"browser",
        "title":"Home",
        "version":5
      }
    }

### Tags for Dashboard


`GET /api/dashboards/tags`

Get all tabs of dashboards

**Example Request**:

    GET /api/dashboards/home HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "term":"tag1",
        "count":1
      },
      {
        "term":"tag2",
        "count":4
      }
    ]

### Dashboard from JSON file

`GET /file/:file`

### Search Dashboards

`GET /api/search/`

Status Codes:

- **query** – Search Query
- **tags** – Tags to use
- **starred** – Flag indicating if only starred Dashboards should be returned
- **tagcloud** - Flag indicating if a tagcloud should be returned

**Example Request**:

    GET /api/search?query=MyDashboard&starred=true&tag=prod HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "id":1,
        "title":"Production Overview",
        "uri":"db/production-overview",
        "type":"dash-db",
        "tags":[],
        "isStarred":false
      }
    ]

## Data sources

### Get all datasources

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

### Get a single data sources by Id

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

### Create data source

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

### Update an existing data source

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

### Delete an existing data source

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

### Available data source types

`GET /api/datasources/plugins`

**Example Request**:

    GET /api/datasources/plugins HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "grafana":{
        "metrics":true,"module":"plugins/datasource/grafana/datasource",
        "name":"Grafana (for testing)",
        "partials":{
          "query":"app/plugins/datasource/grafana/partials/query.editor.html"
        },
        "pluginType":"datasource",
        "serviceName":"GrafanaDatasource",
        "type":"grafana"
      }
    }

## Data source proxy calls

`GET /api/datasources/proxy/:datasourceId/*`

Proxies all calls to the actual datasource.

## Organisation

### Get current Organisation

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

### Update current Organisation

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


### Get all users within the actual organisation

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

### Add a new user to the actual organisation

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

### Updates the given user

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


### Delete user in actual organisation

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


## Organisations

### Search all Organisations

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

### Update Organisation

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

### Get Users in Organisation

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

### Add User in Organisation

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

### Update Users in Organisation

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

### Delete User in Organisation

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

## Users

### Search Users

`GET /api/users`

**Example Request**:

    GET /api/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "id": 1,
        "name": "Admin",
        "login": "admin",
        "email": "admin@mygraf.com",
        "isAdmin": true
      },
      {
        "id": 2,
        "name": "User",
        "login": "user",
        "email": "user@mygraf.com"
        "isAdmin": false
      }
    ]

### Get single user by Id

`GET /api/users/:id`

**Example Request**:

    GET /api/users/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "email": "user@mygraf.com"
      "name": "admin",
      "login": "admin",
      "theme": "light",
      "orgId": 1,
      "isGrafanaAdmin": true
    }

### User Update

`PUT /api/users/:id`

**Example Request**:

    PUT /api/users/2 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "email":"user@mygraf.com",
      "name":"User2",
      "login":"user",
      "theme":"light"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"User updated"}


### Get Organisations for user

`GET /api/users/:id/orgs`

**Example Request**:

    GET /api/users/1/orgs HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "orgId":1,
        "name":"Main Org.",
        "role":"Admin"
      }
    ]

## User

### Actual User

`GET /api/user`

**Example Request**:

    GET /api/user HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "email":"admin@mygraf.com",
      "name":"Admin",
      "login":"admin",
      "theme":"light",
      "orgId":1,
      "isGrafanaAdmin":true
    }

### Change Password

`PUT /api/user/password`

Changes the password for the user

**Example Request**:

    PUT /api/user/password HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "oldPassword": "old_password",
      "newPassword": "new_password",
      "confirmNew": "confirm_new_password"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"User password changed"}

### Switch user context

`POST /api/user/using/:organisationId`

Switch user context to the given organisation.

**Example Request**:

    POST /api/user/using/2 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Active organization changed"}

### Organisations of the actual User

`GET /api/user/orgs`

Return a list of all organisations of the current user.

**Example Request**:

    GET /api/user/orgs HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "orgId":1,
        "name":"Main Org.",
        "role":"Admin"
      }
    ]

### Star a dashboard

`POST /api/user/stars/dashboard/:dashboardId`

Stars the given Dashboard for the actual user.

**Example Request**:

    POST /api/user/stars/dashboard/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Dashboard starred!"}

### Unstar a dashboard

`DELETE /api/user/stars/dashboard/:dashboardId`

Deletes the starring of the given Dashboard for the actual user.

**Example Request**:

    DELETE /api/user/stars/dashboard/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Dashboard unstarred"}


## Snapshots

### Create new snapshot

`POST /api/snapshots`

**Example Request**:

    POST /api/snapshots HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "dashboard": {
        "editable":false,
        "hideControls":true,
        "nav":[
        {
          "enable":false,
        "type":"timepicker"
        }
        ],
        "rows": [
          {

          }
        ],
        "style":"dark",
        "tags":[],
        "templating":{
          "list":[
          ]
        },
        "time":{
        },
        "timezone":"browser",
        "title":"Home",
        "version":5
        }
      "expires": 3600
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "deleteKey":"XXXXXXX",
      "deleteUrl":"myurl/dashboard/snapshot/XXXXXXX",
      "key":"YYYYYYY",
      "url":"myurl/dashboard/snapshot/YYYYYYY"
    }

Keys:

- **deleteKey** – Key generated to delete the snapshot
- **key** – Key generated to share the dashboard

### Get Snapshot by Id

`GET /api/snapshots/:key`

**Example Request**:

    GET /api/snapshots/YYYYYYY HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "meta":{
        "isSnapshot":true,
        "type":"snapshot",
        "canSave":false,
        "canEdit":false,
        "canStar":false,
        "slug":"",
        "expires":"2200-13-32T25:23:23+02:00",
        "created":"2200-13-32T28:24:23+02:00"},

    {
      "dashboard": {
        "editable":false,
        "hideControls":true,
        "nav":[
        {
          "enable":false,
        "type":"timepicker"
        }
        ],
        "rows": [
          {

          }
        ],
        "style":"dark",
        "tags":[],
        "templating":{
          "list":[
          ]
        },
        "time":{
        },
        "timezone":"browser",
        "title":"Home",
        "version":5
        }
    }

### Delete Snapshot by Id

`GET /api/snapshots-delete/:key`

**Example Request**:

    GET /api/snapshots/YYYYYYY HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Snapshot deleted. It might take an hour before it's cleared from a CDN cache."}


## Frontend Settings

### Get Settings

`GET /api/frontend/settings`

**Example Request**:

    GET /api/frontend/settings HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "allowOrgCreate":true,
      "appSubUrl":"",
      "buildInfo":{
        "buildstamp":xxxxxx,
        "commit":"vyyyy",
        "version":"zzzzz"
      },
      "datasources":{
        "datasourcename":{
        "index":"grafana-dash",
        "meta":{
          "annotations":true,
          "module":"plugins/datasource/grafana/datasource",
          "name":"Grafana",
          "partials":{
            "annotations":"app/plugins/datasource/grafana/partials/annotations.editor.html",
            "config":"app/plugins/datasource/grafana/partials/config.html"
            },
          "pluginType":"datasource",
          "serviceName":"Grafana",
          "type":"grafanasearch"
        }
        }
      }

      defaultDatasource: "Grafana"
    }

## Login

### Renew session based on remember cookie

`GET /api/login/ping`

**Example Request**:

    GET /api/login/ping HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message": "Logged in"}

## Admin

### Settings

`GET /api/admin/settings`

**Example Request**:

    GET /api/admin/settings
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
    "DEFAULT":
    {
      "app_mode":"production"},
      "analytics":
      {
        "google_analytics_ua_id":"",
        "reporting_enabled":"false"
      },
      "auth.anonymous":{
        "enabled":"true",
        "org_name":"Main Org.",
        "org_role":"Viewer"
      },
      "auth.basic":{
        "enabled":"false"
      },
      "auth.github":{
        "allow_sign_up":"false",
        "allowed_domains":"",
        "allowed_organizations":"",
        "api_url":"https://api.github.com/user",
        "auth_url":"https://github.com/login/oauth/authorize",
        "client_id":"some_id",
        "client_secret":"************",
        "enabled":"false",
        "scopes":"user:email",
        "team_ids":"",
        "token_url":"https://github.com/login/oauth/access_token"
      },
      "auth.google":{
        "allow_sign_up":"false","allowed_domains":"",
        "api_url":"https://www.googleapis.com/oauth2/v1/userinfo",
        "auth_url":"https://accounts.google.com/o/oauth2/auth",
        "client_id":"some_client_id",
        "client_secret":"************",
        "enabled":"false",
        "scopes":"https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        "token_url":"https://accounts.google.com/o/oauth2/token"
      },
      "auth.ldap":{
        "config_file":"/etc/grafana/ldap.toml",
        "enabled":"false"
      },
      "auth.proxy":{
        "auto_sign_up":"true",
        "enabled":"false",
        "header_name":"X-WEBAUTH-USER",
        "header_property":"username"
      },
      "dashboards.json":{
        "enabled":"false",
        "path":"/var/lib/grafana/dashboards"
      },
      "database":{
        "host":"127.0.0.1:0000",
        "name":"grafana",
        "password":"************",
        "path":"grafana.db",
        "ssl_mode":"disable",
        "type":"sqlite3",
        "user":"root"
      },
      "emails":{
        "templates_pattern":"emails/*.html",
        "welcome_email_on_sign_up":"false"
      },
      "event_publisher":{
        "enabled":"false",
        "exchange":"grafana_events",
        "rabbitmq_url":"amqp://localhost/"
      },
      "log":{
        "buffer_len":"10000",
        "level":"Info",
        "mode":"file"
      },
      "log.console":{
        "level":""
      },
      "log.file":{
        "daily_rotate":"true",
        "file_name":"",
        "level":"",
        "log_rotate":"true",
        "max_days":"7",
        "max_lines":"1000000",
        "max_lines_shift":"28",
        "max_size_shift":""
      },
      "paths":{
        "data":"/tsdb/grafana",
        "logs":"/logs/apps/grafana"},
        "security":{
        "admin_password":"************",
        "admin_user":"admin",
        "cookie_remember_name":"grafana_remember",
        "cookie_username":"grafana_user",
        "disable_gravatar":"false",
        "login_remember_days":"7",
        "secret_key":"************"
      },
      "server":{
        "cert_file":"",
        "cert_key":"",
        "domain":"mygraf.com",
        "enable_gzip":"false",
        "enforce_domain":"false",
        "http_addr":"127.0.0.1",
        "http_port":"0000",
        "protocol":"http",
        "root_url":"%(protocol)s://%(domain)s:%(http_port)s/",
        "router_logging":"true",
        "static_root_path":"public"
      },
      "session":{
        "cookie_name":"grafana_sess",
        "cookie_secure":"false",
        "gc_interval_time":"",
        "provider":"file",
        "provider_config":"sessions",
        "session_life_time":"86400"
      },
      "smtp":{
        "cert_file":"",
        "enabled":"false",
        "from_address":"admin@grafana.localhost",
        "host":"localhost:25",
        "key_file":"",
        "password":"************",
        "skip_verify":"false",
        "user":""},
      "users":{
        "allow_org_create":"true",
        "allow_sign_up":"false",
        "auto_assign_org":"true",
        "auto_assign_org_role":"Viewer"
      }
    }

### Global Users

`POST /api/admin/users`

Create new user

**Example Request**:

    POST /api/admin/users HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "name":"User",
      "email":"user@graf.com",
      "login":"user",
      "password":"userpassword"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"id":5,"message":"User created"}

### Password for User

`PUT /api/admin/users/:id/password`

Change password for specific user

**Example Request**:

    PUT /api/admin/users/2/password HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"password":"userpassword"}

### Permissions

`PUT /api/admin/users/:id/permissions`

**Example Request**:

    PUT /api/admin/users/2/permissions HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {message: "User permissions updated"}

### Delete global User

`DELETE /api/admin/users/:id`

**Example Request**:

    DELETE /api/admin/users/2 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {message: "User deleted"}
