---
aliases:
  - ../../http_api/serviceaccount/
canonical: /docs/grafana/latest/developers/http_api/serviceaccount/
description: Grafana service account HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - serviceaccount
labels:
  products:
    - enterprise
    - oss
title: Service account HTTP API
---

# Service account API

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.
> For Grafana Cloud instances, please use a Bearer token to authenticate. The examples within this section reference Basic authentication which is for On-Prem Grafana instances.

## Search service accounts with Paging

`GET /api/serviceaccounts/search?perpage=10&page=1&query=myserviceaccount`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action               | Scope |
| -------------------- | ----- |
| serviceaccounts:read | n/a   |

**Example Request**:

```http
GET /api/serviceaccounts/search?perpage=10&page=1&query=mygraf HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

Default value for the `perpage` parameter is `1000` and for the `page` parameter is `1`. The `totalCount` field in the response can be used for pagination of the user list E.g. if `totalCount` is equal to 100 users and the `perpage` parameter is set to 10 then there are 10 pages of users. The `query` parameter is optional and it will return results where the query value is contained in one of the `name`. Query values with spaces need to be URL encoded e.g. `query=Jane%20Doe`.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
	"totalCount": 2,
	"serviceAccounts": [
		{
			"id": 1,
			"name": "grafana",
			"login": "sa-grafana",
			"orgId": 1,
			"isDisabled": false,
			"role": "Viewer",
			"tokens": 0,
			"avatarUrl": "/avatar/85ec38023d90823d3e5b43ef35646af9",
			"accessControl": {
				"serviceaccounts:delete": true,
				"serviceaccounts:read": true,
				"serviceaccounts:write": true
			}
		},
		{
			"id": 2,
			"name": "test",
			"login": "sa-test",
			"orgId": 1,
			"isDisabled": false,
			"role": "Viewer",
			"tokens": 0,
			"avatarUrl": "/avatar/8ea890a677d6a223c591a1beea6ea9d2",
			"accessControl": {
				"serviceaccounts:delete": true,
				"serviceaccounts:read": true,
				"serviceaccounts:write": true
			}
		}
	],
	"page": 1,
	"perPage": 10
}
```

## Create service account

`POST /api/serviceaccounts`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                 | Scope |
| ---------------------- | ----- |
| serviceaccounts:create | n/a   |

**Example Request**:

```http
POST /api/serviceaccounts HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=

{
  "name": "grafana",
  "role": "Viewer",
  "isDisabled": false
}
```

**Example Response**:

```http
HTTP/1.1 201
Content-Type: application/json

{
	"id": 1,
	"name": "test",
	"login": "sa-test",
	"orgId": 1,
	"isDisabled": false,
	"createdAt": "2022-03-21T14:35:33Z",
	"updatedAt": "2022-03-21T14:35:33Z",
	"avatarUrl": "/avatar/8ea890a677d6a223c591a1beea6ea9d2",
	"role": "Viewer",
	"teams": []
}
```

## Get a service account by ID

`GET /api/serviceaccounts/:id`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action               | Scope                 |
| -------------------- | --------------------- |
| serviceaccounts:read | serviceaccounts:id:\* |

**Example Request**:

```http
GET /api/serviceaccounts/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"id": 1,
	"name": "test",
	"login": "sa-test",
	"orgId": 1,
	"isDisabled": false,
	"createdAt": "2022-03-21T14:35:33Z",
	"updatedAt": "2022-03-21T14:35:33Z",
	"avatarUrl": "/avatar/8ea890a677d6a223c591a1beea6ea9d2",
	"role": "Viewer",
	"teams": []
}
```

## Update service account

`PATCH /api/serviceaccounts/:id`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                | Scope                 |
| --------------------- | --------------------- |
| serviceaccounts:write | serviceaccounts:id:\* |

**Example Request**:

```http
PATCH /api/serviceaccounts/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=

{
  "name": "test",
	"role": "Editor"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"id": 2,
	"name": "test",
	"login": "sa-grafana",
	"orgId": 1,
	"isDisabled": false,
	"createdAt": "2022-03-21T14:35:44Z",
	"updatedAt": "2022-03-21T14:35:44Z",
	"avatarUrl": "/avatar/8ea890a677d6a223c591a1beea6ea9d2",
	"role": "Editor",
	"teams": []
}
```

## Delete service account

`DELETE /api/serviceaccounts/:id`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                 | Scope                 |
| ---------------------- | --------------------- |
| serviceaccounts:delete | serviceaccounts:id:\* |

**Example Request**:

```http
DELETE /api/serviceaccounts/2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"message": "Service account deleted"
}
```

---

## Migrate API keys to service accounts

`POST /api/serviceaccounts/migrate`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                | Scope              |
| --------------------- | ------------------ |
| serviceaccounts:write | serviceaccounts:\* |

**Example Request**:

```http
POST /api/serviceaccounts/migrate HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"message": "API keys migrated to service accounts"
}
```

## Migrate API key to service account

`POST /api/serviceaccounts/migrate/:keyId`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                | Scope              |
| --------------------- | ------------------ |
| serviceaccounts:write | serviceaccounts:\* |

**Example Request**:

```http
POST /api/serviceaccounts/migrate/4 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"message": "Service accounts migrated"
}
```

## Get API key to service account migration status

`GET /api/serviceaccounts/migrationstatus`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action               | Scope              |
| -------------------- | ------------------ |
| serviceaccounts:read | serviceaccounts:\* |

**Example Request**:

```http
POST /api/serviceaccounts/migrationstatus HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"migrated": true
}
```

## Hide the API keys tab

`GET /api/serviceaccounts/hideApiKeys`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                | Scope              |
| --------------------- | ------------------ |
| serviceaccounts:write | serviceaccounts:\* |

**Example Request**:

```http
POST /api/serviceaccounts/hideApiKeys HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"message": "API keys hidden"
}
```

## Get service account tokens

`GET /api/serviceaccounts/:id/tokens`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action               | Scope                 |
| -------------------- | --------------------- |
| serviceaccounts:read | serviceaccounts:id:\* |

**Example Request**:

```http
GET /api/serviceaccounts/2/tokens HTTP/1.1
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
		"id": 1,
		"name": "grafana",
		"role": "Viewer",
		"created": "2022-03-23T10:31:02Z",
		"expiration": null,
		"secondsUntilExpiration": 0,
		"hasExpired": false
	}
]
```

## Create service account tokens

`POST /api/serviceaccounts/:id/tokens`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                | Scope                 |
| --------------------- | --------------------- |
| serviceaccounts:write | serviceaccounts:id:\* |

**Example Request**:

```http
POST /api/serviceaccounts/2/tokens HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=

{
	"name": "grafana"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"id": 7,
	"name": "grafana",
	"key": "eyJrIjoiVjFxTHZ6dGdPSjg5Um92MjN1RlhjMkNqYkZUbm9jYkwiLCJuIjoiZ3JhZmFuYSIsImlkIjoxfQ=="
}
```

## Delete service account tokens

`DELETE /api/serviceaccounts/:id/tokens/:tokenId`

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                | Scope                 |
| --------------------- | --------------------- |
| serviceaccounts:write | serviceaccounts:id:\* |

**Example Request**:

```http
DELETE /api/serviceaccounts/2/tokens/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"message": "API key deleted"
}
```

## Revert service account token to API key

`DELETE /api/serviceaccounts/:serviceAccountId/revert/:keyId`

This operation will delete the service account and create a legacy API Key for the given `keyId`.

**Required permissions**

See note in the [introduction]({{< ref "#service-account-api" >}}) for an explanation.

| Action                 | Scope                 |
| ---------------------- | --------------------- |
| serviceaccounts:delete | serviceaccounts:id:\* |

**Example Request**:

```http
DELETE /api/serviceaccounts/1/revert/glsa_VVQjot0nijQ59lun6pMZRtsdBXxnFQ9M_77c34a79 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Basic YWRtaW46YWRtaW4=
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
	"message": "Reverted service account to API key"
}
```
