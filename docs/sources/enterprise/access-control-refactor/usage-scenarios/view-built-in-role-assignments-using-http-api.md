---
title: 'View built-in role assignments using the HTTP API'
menuTitle: 'View built-in role assignments using the HTTP API'
description: 'xxx.'
aliases: [xxx]
weight: 50
keywords:
  - xxx
---

# View built-in role assignments using the HTTP API

You can use the [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control.md#get-all-built-in-role-assignments" >}}) to see all available built-in role assignments.
The response contains a mapping between one of the organization roles (`Viewer`, `Editor`, `Admin`) or `Grafana Admin` to the custom or fixed roles.

Before you get started, make sure to [enable fine-grained access control]({{< relref "./_index.md#enable-fine-grained-access-control" >}}).

Example request:

```
curl --location --request GET '<grafana_url>/api/access-control/builtin-roles' --header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
```

You must use the base64 username:password Basic Authorization here. Auth tokens are not applicable here.

Example response:

```
{
    "Admin": [
        ...
        {
            "version": 2,
            "uid": "qQui_LCMk",
            "name": "fixed:users:org:writer",
            "displayName": "Users Organization writer",
            "description": "Within a single organization, add a user, invite a user, read information about a user and their role, remove a user from that organization, or change the role of a user.",
            "global": true,
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        },
        {
            "version": 1,
            "uid": "Kz9m_YjGz",
            "name": "fixed:reports:writer",
            "displayName": "Report writer",
            "description": "Create, read, update, or delete all reports and shared report settings.",
            "global": true,
            "updated": "2021-05-13T16:24:26+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        }
        ...
    ],
    "Grafana Admin": [
        ...
        {
            "version": 2,
            "uid": "qQui_LCMk",
            "name": "fixed:users:writer",
            "displayName": "User writer",
            "description": "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
            "global": true,
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        },
        {
            "version": 2,
            "uid": "ajum_YjGk",
            "name": "fixed:users:reader",
            "displayName": "User reader",
            "description": "Allows every read action for user organizations and in addition allows to administer user organizations.",
            "global": true,
            "updated": "2021-05-17T20:49:17+02:00",
            "created": "2021-05-13T16:24:26+02:00"
        },
        ...
    ]
}
```

To see what permissions each of the assigned roles have, you can a [Get a role]({{< relref "../../http_api/access_control.md#get-a-role" >}}) by using an HTTP API.

Example request:

```
curl --location --request GET '<grafana_url>/api/access-control/roles/qQui_LCMk' --header 'Authorization: Basic YWRtaW46cGFzc3dvcmQ='
```

Example response:

```
{
    "version": 2,
    "uid": "qQui_LCMk",
    "name": "fixed:users:writer",
    "displayName": "User writer",
    "description": "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
    "global": true,
    "permissions": [
        {
            "action": "org.users:add",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        },
        {
            "action": "org.users:read",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        },
        {
            "action": "org.users:remove",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        },
        {
            "action": "org.users.role:update",
            "scope": "users:*",
            "updated": "2021-05-17T20:49:18+02:00",
            "created": "2021-05-17T20:49:18+02:00"
        }
    ],
    "updated": "2021-05-17T20:49:18+02:00",
    "created": "2021-05-13T16:24:26+02:00"
}
```
