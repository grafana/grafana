+++
title = "Managing roles and permissions"
description = "Understand how to manage roles and permissions"
keywords = ["grafana", "fine-grained-access-control", "roles", "permissions", "enterprise"]
weight = 110
+++

# Managing roles and permissions

You can grant, change and revoke access to a resource by creating [built-in role assignments]({{< relref "./concepts/roles.md#built-in-role-assignments" >}}). You can do this by either using [Access Control API]({{< relref "../../http_api/access_control.md" >}}) or [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

## Before you begin

- Understand [Access management]({{< relref "./_index.md" >}})
- Understand [Concepts]({{< relref "./concepts/_index.md" >}})

## Resources with fine-grained permissions 

The access control is in Beta and fine-grained [permissions]({{< relref "./concepts/permissions.md" >}}) are available only for a subset of resources. 
Refer to the relevant API guide from below list to learn more about specific endpoints where access control is applied.

1. [Access Control API]({{< relref "../../http_api/access_control.md" >}})
1. [Admin API]({{< relref "../../http_api/admin.md" >}})
1. [Organization API]({{< relref "../../http_api/org.md" >}})
1. [Reporting API]({{< relref "../../http_api/reporting.md" >}})
1. [User API]({{< relref "../../http_api/user.md" >}})

## Create and manage custom roles

You can create, update and delete custom roles by using an [Access Control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by [provisioning]({{< relref "./provisioning.md" >}}).

By default, Grafana Admin has a [built-in role assignment]({{< relref "./concepts/roles.md" >}}) which allows a user to manage custom roles. 
If a Grafana Admin wants to delegate that privilege to other users, they can create a custom role with relevant [permissions]({{< relref "./concepts/permissions.md" >}}) and `permissions:delegate` scope will allow those users to manage roles themselves.
Note that you won't be able to create, update or delete a custom role with permissions which you yourself do not have. For example, if the only permission you have is a `users:create`, you won't be able to create a role with other permissions.

Custom roles can be created either as `global` or `organization local`.

To create or delete `organization local` custom role, you need to:
1. Be authenticated with the relevant organization
1. Set `global` to `false` in the relevant API request or in the provisioning file.

To create or remove `global` custom role, you need to:
1. Set `global` to `true` in the relevant API request or in the provisioning file.

## Creating and removing built-in role assignments

You can create or remove built-in role assignment by using an [Access Control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by [provisioning]({{< relref "./provisioning.md" >}}).
By default, Grafana Admin already has a [built-in role assignment]({{< relref "./concepts/roles.md" >}}) which allows a user to manage further assignments. 

Assignments can be either `global` or `organization local`. Global assignments will take an effect across all organizations and all [predefined roles]({{< relref "./concepts/roles.md#predefined-roles" >}}) by default are `global`.

To create or remove `organization local` assignment, you need to:
1. Be authenticated with the relevant organization
1. Set `global` to `false` in the relevant API request or in the provisioning file.
1. You will be able to assign a role only to an organization for which a role has been created.

To create or remove `global` assignment, you need to:
1. Set `global` to `true` in the relevant API request or in the provisioning file.
