---
title: 'Create a custom role using the HTTP API'
menuTitle: 'Create a custom role using the HTTP API'
description: 'xxx.'
aliases: [xxx]
weight: 10
keywords:
  - xxx
---

# Create a custom role using the HTTP API

You can create your custom role by either using an [HTTP API]({{< relref "../../http_api/access_control.md#create-a-new-custom-role" >}}) or by using [Grafana provisioning]({{< relref "./provisioning.md" >}}).
You can take a look at [actions and scopes]({{< relref "./provisioning.md#action-definitions" >}}) to decide what permissions would you like to map to your role.

Before you get started, make sure to [enable fine-grained access control]({{< relref "./_index.md#enable-fine-grained-access-control" >}}).

Example HTTP request:

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

Example response:

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

Once the custom role is created, you can create a built-in role assignment by using an [HTTP API]({{< relref "../../http_api/access_control.md#create-a-built-in-role-assignment" >}}).
If you created your role using [Grafana provisioning]({{< relref "./provisioning.md" >}}), you can also create the assignment with it.

Example HTTP request:

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

Example response:

```
{
    "message": "Built-in role grant added"
}
```
