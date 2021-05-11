+++
title = "Fine-grained access control HTTP API "
description = "Fine-grained access control API"
keywords = ["grafana", "http", "documentation", "api", "fine-grained-access-control", "acl", "enterprise"]
aliases = ["/docs/grafana/latest/http_api/accesscontrol/"]
+++

# Fine-grained access control API

> Fine-grained access control API is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "../enterprise" >}}).

The API can be used to create, update, get and list roles, and create or remove built-in role assignments. 
To use the API, you would need to [enable fine-grained access control]({{< relref "../enterprise/access-control/_index.md#enable-fine-grained-access-control" >}}).

## Create and manage custom roles

### Get all roles

`GET /api/access-control/roles`

Gets all existing roles.

#### Required permissions

Action | Scope 
--- | --- | 
roles:list | roles:* 

#### Example request

```http
GET /api/access-control/roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

[
    {
        "orgId": 1,
        "version": 1,
        "uid": "PYnDO3rMk",
        "name": "grafana:roles:ldap:admin:edit",
        "description": "",
        "updated": "2021-05-04T13:07:30+02:00",
        "created": "0001-01-01T00:00:00Z"
    },
    {
        "orgId": 1,
        "version": 1,
        "uid": "PYnDO3rMk1",
        "name": "grafana:roles:users:admin:read",
        "description": "",
        "updated": "2021-05-04T13:07:30+02:00",
        "created": "0001-01-01T00:00:00Z"
    }
]
```

#### Status codes

Code | Description
--- | --- | 
200 | Roles are returned.
403 | Access denied
500 | Unexpected error. Refer to body and/or server logs for more details.

### Get a role

`GET /api/access-control/roles/:uid`

Get a role for the given UID.

#### Required permissions

Action | Scope
--- | --- | 
roles:read | roles:*

#### Example request

```http
GET /api/access-control/roles/PYnDO3rMk
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "orgId": 1,
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

#### Status codes

Code | Description
--- | --- | 
200 | Role is returned.
403 | Access denied
500 | Unexpected error. Refer to body and/or server logs for more details.

### Create a new custom role

`POST /api/access-control/roles`

Creates a new custom role and maps given permissions to that role. Note that roles with the same prefix as [Predefined Roles]({{< relref "../enterprise/access-control/roles.md" >}}) can't be created.

#### Required permissions

You can only create roles with a subset of your own permissions.

Action | Scope
--- | --- | 
roles:write | permissions:delegate

#### Example request

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

#### JSON body schema

Field Name | Date Type | Required | Description
--- | --- | --- | ---
uid | string | No | UID of the role. If not present, the UID will be automatically created for you and returned in response.
global | boolean | No | A flag indicating if the role is global or not. If set to `false`, [default org ID]({{< relref "../administration/configuration/#auto_assign_org_id" >}}) is used.
version | number | No | Version of the role. If not present, version number 1 will be assigned to the role and returned in the response.
name | string | Yes | Name of the role.
description | string | No | Description of the role.
permissions | Permission | No | If not present, the role will be created without any permissions.

**Permission**

Field Name | Data   Type | Required | Description
--- | --- | --- | ---
action | string | Yes | Refer to [Permissions]({{< relref "../enterprise/access-control/permissions.md" >}}) for full list of available actions.
scope | string | No | If not present, no scope will be mapped to the permission. Refer to [Permissions]({{< relref "../enterprise/access-control/permissions.md#scope-definitions" >}}) for full list of available scopes.

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "orgId": 1,
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

#### Status codes

Code | Description
--- | --- | 
200 | Role is updated.
400 | Bad request (invalid json, missing content-type, missing or invalid fields, etc.).
403 | Access denied
500 | Unexpected error. Refer to body and/or server logs for more details.

### Update a custom role

`PUT /api/access-control/roles/:uid`

Update the role with the given UID, and it's permissions with the given UID. The operation is idempotent and all permissions of the role will be replaced with what is in the request. You would need to increment the version of the role with each update, otherwise the request will fail.

#### Required permissions

User will be able to create a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles:write | permissions:delegate

#### Example request

```http
PUT /api/access-control/roles/PYnDO3rMk
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "version": 2,
    "name": "custom:role:new",
    "description": "My new custom role",
    "permissions": [
        {
            "action": "users:create",
            "scope": "",
        }
    ],
}
```

#### JSON body schema

Field Name | Data Type | Required | Description
--- | --- | --- | ---
version | number | Yes | Version of the role. Must be incremented for update to work.
name | string | Yes | Name of the role.
description | string | No | Description of the role.
permissions | List of Permissions | No | The full list of permissions the role should have after the update.

**Permission**

Field Name | Data   Type | Required | Description
--- | --- | --- | ---
action | string | Yes | Refer to [Permissions]({{< relref "../enterprise/access-control/permissions.md" >}}) for full list of available actions.
scope | string | No | If not present, no scope will be mapped to the permission. Refer to [Permissions]({{< relref "../enterprise/access-control/permissions.md#scope-definitions" >}}) for full list of available scopes.

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "orgId": 1,
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
    "created": "2021-05-04T13:36:11.141936+02:00",
}
```

#### Status codes

Code | Description
--- | --- | 
200 | Role is updated.
400 | Bad request (invalid json, missing content-type, missing or invalid fields, etc.).
403 | Access denied
404 | Role was not found to  update.
500 | Unexpected error. Refer to body and/or server logs for more details.

### Delete a custom role

`DELETE /api/access-control/roles/:uid?force=false`

Delete a role with the given UID, and it's permissions. If the role is assigned to a built-in role, the deletion operation will fail, unless `force` query param is set to `true`, and in that case all assignments will also be deleted.

#### Required permissions

User will be able to delete a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles:delete | permissions:delegate

#### Example request

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

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "message": "Role deleted"
}
```

#### Status codes

Code | Description
--- | --- | 
200 | Role is deleted.
400 | Bad request (invalid json, missing content-type, missing or invalid fields, etc.).
403 | Access denied
500 | Unexpected error. Refer to body and/or server logs for more details.

## Create and remove built-in role assignments

API set allows to create or remove [built-in role assignments]({{< relref "../enterprise/access-control/roles.md#built-in-role-assignments" >}}) and list current assignments. 

### Get all built-in role assignments

`GET /api/access-control/builtin-roles`

Gets all built-in role assignments.

#### Required permissions

User will be able to create a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles.builtin:list | roles:*

#### Example request

```http
GET /api/access-control/builtin-roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

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

#### Status codes

Code | Description
--- | --- | 
200 | Built-in role assignments are returned.
403 | Access denied
500 | Unexpected error. Refer to body and/or server logs for more details.

### Create a built-in role assignment

`POST /api/access-control/builtin-roles`

Creates a new built-in role assignment.

#### Required permissions

User will be able to add a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles.builtin:add | permissions:delegate

#### Example request

```http
POST /api/access-control/builtin-roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "roleUid": "LPMGN99Mk",
    "builtinRole": "Grafana Admin",
    "global": false
}
```

#### JSON body schema

Field Name | Date Type | Required | Description
--- | --- | --- | ---
roleUid | string | Yes | UID of the role.
builtinRole | boolean | Yes | Can be one of `Viewer`, `Editor`, `Admin` or `Grafana Admin`.
global | boolean | No | A flag indicating if the assignment is global or not. If set to `false`, [default org ID]({{< relref "../administration/configuration/#auto_assign_org_id" >}}) is used.

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "message": "Built-in role grant added"
}
```

#### Status codes

Code | Description
--- | --- | 
200 | Role was assigned to built-in role.
400 | Bad request (invalid json, missing content-type, missing or invalid fields, etc.).
403 | Access denied
404 | Role not found
500 | Unexpected error. Refer to body and/or server logs for more details.

### Remove a built-in role assignment

`DELETE /api/access-control/builtin-roles`

Deletes a built-in role assignment.

#### Required permissions

User will be able to delete a role only with permissions they themselves have.

Action | Scope
--- | --- | 
roles.builtin:remove | permissions:delegate

#### Example request

```http
DELETE /api/access-control/builtin-roles
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "roleUid": "LPMGN99Mk",
    "builtinRole": "Grafana Admin",
    "global": false
}
```
#### JSON body schema

Field Name | Date Type | Required | Description
--- | --- | --- | ---
roleUid | string | Yes | UID of the role.
builtinRole | boolean | Yes | Can be one of `Viewer`, `Editor`, `Admin` or `Grafana Admin`. 
global | boolean | No | A flag indicating if the assignment is global or not. If set to `false`, [default org ID]({{< relref "../administration/configuration/#auto_assign_org_id" >}}) is used.

#### Example response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
    "message": "Built-in role grant removed"
}
```

#### Status codes

Code | Description
--- | --- | 
200 | Role was unassigned from built-in role.
400 | Bad request (invalid json, missing content-type, missing or invalid fields, etc.).
403 | Access denied
404 | Role not found
500 | Unexpected error. Refer to body and/or server logs for more details.
