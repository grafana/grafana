+++
title = "Access control HTTP API "
description = "Access control API"
keywords = ["grafana", "http", "documentation", "api", "access-control", "acl", "enterprise"]
aliases = ["/docs/grafana/latest/http_api/accesscontrol/"]
+++

# Access Control API

> The Access Control is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "../enterprise" >}}).

This API can be used to create, update, get and list roles, and add or revoke role assignments for built-in roles. By default, the API assumes that the requests are done for the organization that users is signed in. Refer to [Access Control Roles]({{< relref "../enterprise/access-control/concepts" >}}) to learn more about how you can use access control.

## Create and manage custom roles

### Get all roles

`GET /api/access-control/roles`

Gets all existing roles.

**Required Permissions**

Action | Scope 
--- | --- | 
roles:list | roles:* 

**Example request:**

```http
GET /api/access-control/roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 551

[
    {
        "version": 1,
        "uid": "PYnDO3rMk",
        "name": "grafana:roles:ldap:admin:edit",
        "description": "",
        "updated": "2021-05-04T13:07:30+02:00",
        "created": "0001-01-01T00:00:00Z"
    },
    {
        "version": 1,
        "uid": "PYnDO3rMk1",
        "name": "grafana:roles:users:admin:read",
        "description": "",
        "updated": "2021-05-04T13:07:30+02:00",
        "created": "0001-01-01T00:00:00Z"
    }
]
```

Status codes:

- **200** - Ok
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error

### Get a role

`GET /api/access-control/roles/:uid`

Get a role for the given UID.

**Required Permissions**

Action | Scope
--- | --- | 
roles:read | roles:* OR roles:<uid>/roles:<uid>

**Example request:**

```http
GET /api/access-control/roles/PYnDO3rMk
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{
    "version": 2,
    "uid": "PYnDO3rMk",
    "name": "custom:role:new",
    "description": "My new custom role",
    "permissions": [
        {
            "action": "users:create",
            "scope": "",
            "updated": "2021-05-04T13:25:43+02:00",
            "created": "2021-05-04T13:25:43+02:00"
        }
    ],
    "updated": "2021-05-04T13:36:11.141936+02:00",
    "created": "0001-01-01T00:00:00Z"
}
```

### Create a new custom role

`POST /api/access-control/roles`

Creates a new custom role and maps given permissions to that role. Note that roles with the same prefix as [Predefined Roles](({{< relref "../enterprise/access-control/concepts/roles" >}})) can't be created.

**Required Permissions**

User will be able to create a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles:write | permissions:delegate

**Example request:**

```http
POST /api/access-control/roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "uid": "",
  "global": false,
  "version": 1,
  "name": "custom:role:new",
  "description": "My new custom role",
  "permissions": [
    {
      "action": "users:create",
      "scope": ""
    },
    {
      "action": "users:read",
      "scope": "global:users:*"
    }
  ]
}
```

JSON Body schema:

Field | Type | Required | Description
--- | --- | --- | ---
uid | string | No | UID of the role. If not present, the UID will be automatically created for you and returned in response.
global | boolean | No | A flag indicating if the role is global or not. See [Access Control Global Roles]({{< relref "../enterprise/access-control/concepts" >}}) for more information.
version | number | No | Version of the role. If not present, version number 1 will be assigned to the role and returned in the response.
name | string | Yes | Name of the role.
description | string | No | Description of the role.
permissions | Permission | No | If not present, the role will be created without any permissions.

Permission

Field | Type | Required | Description
--- | --- | --- | ---
action | string | Yes | For full list of available actions see [Access Control Permissions]({{< relref "../enterprise/access-control/concepts/permissions" >}}).
scope | string | No | If not present, no scope will be mapped to the permission. For full list of available scopes see [Access Control Permissions]({{< relref "../enterprise/access-control/concepts/permissions" >}}).

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{
    "version": 1,
    "uid": "PYnDO3rMk",
    "name": "custom:role:new",
    "description": "My new custom role",
    "permissions": [
        {
            "action": "users:create",
            "scope": "",
            "updated": "2021-05-04T13:25:43.994903+02:00",
            "created": "2021-05-04T13:25:43.994903+02:00"
        },
        {
            "action": "users:read",
            "scope": "global:users:*",
            "updated": "2021-05-04T13:25:43.996923+02:00",
            "created": "2021-05-04T13:25:43.996923+02:00"
        }
    ],
    "updated": "2021-05-04T13:25:43.99269+02:00",
    "created": "2021-05-04T13:25:43.992689+02:00"
}
```

Status codes:

- **200** - Role is successfully created, Ok
- **400** - Roles with the same prefix as predefined roles can't be created, Bad Request
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error

### Update a custom role

`PUT /api/access-control/roles/:uid`

Update the role with the given UID, and it's permissions with the given UID. The operation is idempotent and all permissions of the role will be replaced with what is in the request. You would need to increment the version of the role with each update, otherwise the request will fail.

**Required Permissions**

User will be able to create a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles:write | permissions:delegate

**Example request:**

```http
PUT /api/access-control/roles/PYnDO3rMk
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "version": 2,    
    "uid": "PYnDO3rMk",
    "name": "custom:role:new",
    "description": "My new custom role",
    "permissions": [
        {
            "action": "users:create",
            "scope": "",
            "updated": "2021-05-04T13:25:43.994903+02:00",
            "created": "2021-05-04T13:25:43.994903+02:00"
        }
    ],
    "updated": "2021-05-04T13:25:43.99269+02:00",
    "created": "2021-05-04T13:25:43.992689+02:00"
}
```

JSON Body schema:

Field | Type | Required | Description
--- | --- | --- | ---
uid | string | No | UID of the role. If not present, the UID will be automatically created for you and returned in response.
global | boolean | No | A flag indicating if the role is global or not. See [Access Control Global Roles]({{< relref "../enterprise/access-control/concepts" >}}) for more information.
version | number | No | Version of the role. If not present, version number 1 will be assigned to the role and returned in the response.
name | string | Yes | Name of the role.
description | string | No | Description of the role.
permissions | Permission | No | If not present, the role will be created without any permissions.

Permission

Field | Type | Required | Description
--- | --- | --- | ---
action | string | Yes | For full list of available actions see [Access Control Permissions]({{< relref "../enterprise/access-control/concepts/permissions" >}}).
scope | string | No | If not present, no scope will be mapped to the permission. For full list of available scopes see [Access Control Permissions]({{< relref "../enterprise/access-control/concepts/permissions" >}}).

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 711

{
    "version": 2,
    "uid": "PYnDO3rMk",
    "name": "custom:role:new",
    "description": "My new custom role",
    "permissions": [
        {
            "action": "users:create",
            "scope": "",
            "updated": "2021-05-04T13:25:43+02:00",
            "created": "2021-05-04T13:25:43+02:00"
        }
    ],
    "updated": "2021-05-04T13:36:11.141936+02:00",
    "created": "0001-01-01T00:00:00Z"
}
```

Status codes:

- **200** - Role is successfully updated, Ok
- **400** - Roles with the same prefix as predefined roles can't be updated, Bad Request
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error

### Delete a custom role

`DELETE /api/access-control/roles/:uid?force=false`

Delete a role with the given UID, and it's permissions. If the role is assigned to a built-in role, the deletion operation will fail, unless `force` query param is set to `true`, and in that case all assignments will also be deleted.

**Required Permissions**

User will be able to delete a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles:delete | permissions:delegate

**Example request:**

```http
DELETE /api/access-control/roles/PYnDO3rMk?force=true
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk}
```

Query params:

Param | Type | Required | Description
--- | --- | --- | ---
force | boolean | No | When set to `true`, the role will be deleted with all it's assignments.

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 711

{
    "message": "Role deleted"
}
```

Status codes:

- **200** - Role is successfully deleted, Ok
- **400** - Roles with the same prefix as predefined roles can't be deleted, Bad Request
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error

## Grant and revoke roles to built-in roles

API set allows to grant, revoke and list roles for built-in roles. Built-in roles are one of `Grafana Admin`, `Admin`, `Editor` or `Viewer`.
Refer to [Access Control Roles]({{< relref "../enterprise/access-control/concepts" >}}) for more information about built-in roles.

### Get all built-in role grants

`GET /api/access-control/builtin-roles`

Gets all built-in role grants.

**Required Permissions**

User will be able to create a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles.builtin:list | roles:*

**Example request:**

```http
GET /api/access-control/builtin-roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 551

{
    "Admin": [
        {
            "version": 1,
            "uid": "C7_SD3rGz",
            "name": "grafana:roles:users:org:read",
            "description": "Desc",
        },
        {
            "version": 1,
            "uid": "nS_SDq9Mz",
            "name": "grafana:roles:users:org:edit",
            "description": "Desc",
        }
    ],
    "Grafana Admin": [
        {
            "version": 1,
            "uid": "Og_SDqrMz",
            "name": "grafana:roles:ldap:admin:edit",
            "description": "Desc",
        }
    ]
}
```

Status codes:

- **200** - Ok
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error

### Create a built-in role grant

`POST /api/access-control/builtin-roles`

Creates a new grant for the given built-in role.

**Required Permissions**

User will be able to add a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles.builtin:add | permissions:delegate

**Example request:**

```http
POST /api/access-control/builtin-roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "roleUid": "LPMGN99Mk",
    "builtinRole": "Grafana Admin",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "message": "Built-in role grant added"
}
```

Status codes:

- **200** - Ok
- **400** - Role is already assigned or the request is invalid, Bad Request
- **404** - Role not found, Not Found  
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error

### Delete a built-in role grant

`DELETE /api/access-control/builtin-roles`

Revokes a grant for the given built-in role.

**Required Permissions**

User will be able to delete a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles.builtin:remove | permissions:delegate

**Example request:**

```http
DELETE /api/access-control/builtin-roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "roleUid": "LPMGN99Mk",
    "builtinRole": "Grafana Admin",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "message": "Built-in role grant removed"
}
```

Status codes:

- **200** - Ok
- **400** - Bad Request
- **404** - Role not found, Not Found
- **403** - Access denied for the operation, Forbidden
- **500** - Internal Server Error


