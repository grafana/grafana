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

### Update Organisation

`PUT /api/orgs/:orgId`

### Get Users in Organisation

`GET /api/orgs/:orgId/users`

### Add User in Organisation

`POST /api/orgs/:orgId/users`

### Update Users in Organisation

`PATCH /api/orgs/:orgId/users/:userId`

### Delete User in Organisation

`DELETE /api/orgs/:orgId/users/:userId`

## Users

### Search Users

`GET /api/users`

### Get single user by Id

`GET /api/users/:id`

### User Update

`PUT /api/users/:id`

### Get Organisations for user

`GET /api/users/:id/orgs`

## User

### Change Password

`PUT /api/user/password`

Changes the password for the user

### Actual User

`GET /api/user`

The above will return the current user.

### Switch user context

`POST /api/user/using/:organisationId`

Switch user context to the given organisation.

### Organisations of the actual User

`GET /api/user/orgs`

The above will return a list of all organisations of the current user.

### Star a dashboard

`POST /api/user/stars/dashboard/:dashboardId`

Stars the given Dashboard for the actual user.

### Unstar a dashboard

`DELETE /api/user/stars/dashboard/:dashboardId`

Deletes the staring of the given Dashboard for the actual user.

## Snapshots

### Create new snapshot

`POST /api/snapshots`

### Get Snapshot by Id

`GET /api/snapshots/:key`

### Delete Snapshot by Id

`DELETE /api/snapshots-delete/:key`

## Frontend Settings

### Get Settings

`GET /api/frontend/settings`

## Login

### Renew session based on remember cookie

`GET /api/login/ping`

## Admin

### Settings

`GET /api/admin/settings`

### Global Users

`POST /api/admin/users`

### Password for User

`PUT /api/admin/users/:id/password`

### Permissions

`PUT /api/admin/users/:id/permissions`

### Delete global User

`DELETE /api/admin/users/:id`
