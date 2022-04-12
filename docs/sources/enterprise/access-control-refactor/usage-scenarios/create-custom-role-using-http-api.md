---
title: 'Create and assign a custom role using the Grafana HTTP API'
menuTitle: 'Create and assign a custom role using the HTTP API'
description: 'xxx.'
aliases: [xxx]
weight: 10
keywords:
  - xxx
---

# Create and assign a custom role using the HTTP API

The following examples show you how to create a custom role using the Grafana HTTP API. For more information about the HTTP API, refer to [Create a new custom role]({{< relref "../../../http_api/access_control.md#create-a-new-custom-role" >}}).

## Before you begin

- [Enable role-based access control]({{< relref "../enable-rbac.md" >}}).
- Determine which actions and scopes you want to add to the custom role. To see a list of actions and scope, refer to [Role-based access control permissions actions and scopes]({{< relref "../custom-role-actions-scopes.md" >}}).

## Create custom role example

The following example creates a `custom:users:admin` role and assigns the `users:create` action to it.

### Example request

```
curl --location --request POST '<grafana_url>/api/access-control/roles/' \
--header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
--header 'Content-Type: application/json' \
--data-raw '{
    "version": 1,
    "uid": "jZrmlLCkGksdka",
    "name": "custom:users:admin",
    "displayName": "custom users admin",
    "description": "My custom role which gives users permissions to create users",
    "global": true,
    "permissions": [
        {
            "action": "users:create"
        }
    ]
}'
```

</br>

### Example response

```
{
    "version": 1,
    "uid": "jZrmlLCkGksdka",
    "name": "custom:users:admin",
    "displayName": "custom users admin",
    "description": "My custom role which gives users permissions to create users",
    "global": true,
    "permissions": [
        {
            "action": "users:create"
            "updated": "2021-05-17T22:07:31.569936+02:00",
            "created": "2021-05-17T22:07:31.569935+02:00"
        }
    ],
    "updated": "2021-05-17T22:07:31.564403+02:00",
    "created": "2021-05-17T22:07:31.564403+02:00"
}
```

## Assign a custom role to a basic role example

After you create a custom role, you can assign it to a basic role. For more information about the HTTP API, refer to [Create a basic role assignment]({{< relref "../../../http_api/access_control.md#create-a-basic-role-assignment" >}}).

### Example request

```
curl --location --request POST '<grafana_url>/api/access-control/builtin-roles' \
--header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ=' \
--header 'Content-Type: application/json' \
--data-raw '{
    "roleUid": "jZrmlLCkGksdka",
    "builtinRole": "Viewer",
    "global": true
}'
```

#### Example response

```
{
    "message": "Built-in role grant added"
}
```
