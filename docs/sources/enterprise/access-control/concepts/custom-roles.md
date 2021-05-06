+++
title = "Custom roles"
description = "Understand custom roles in access control"
keywords = ["grafana", "access-control", "concepts", "roles", "custom-roles", "enterprise"]
weight = 120
+++

# Custom roles

You can create custom roles with permissions to control access for your users the way you want. 
A custom role must have a name and a version. To create, update or delete a custom role, you can use [Access Control API]({{< relref "../../../http_api/access_control.md" >}}) or Grafana Provisioning(todo).
For more information about using custom roles, refer to [Managing roles and permissions]({{< relref "../managing-roles-permissions.md" >}}).

## Role name

The name of a custom role can’t start with `grafana:roles:` prefix, as it is reserved for predefined roles created by the Grafana Enterprise.

## Role version

The version of a role is a number defines the current version of the role. If you want to update the role you must increment the version number first, otherwise the update will fail. This is done to prevent accidental changes and to preserve history over time.

## Permissions

To manage access to the Grafana resources, you must map permissions to the role. A custom role without permissions has no effect, but could be created in any case.

## Role UID

Each custom role has a UID defined which is a unique identifier associated with the role allowing you to change or delete the role. You can either generate UID yourself, or let the API generate one for you.
See [Permissions]({{< relref "./permissions.md" >}}) for full list of available permissions which you can use for your custom roles.

## Scope of the role

Custom role can be either global or organization local. Refer to the [Access Control API]({{< relref "../../../http_api/access_control.md" >}}) to understand how you can specify the scope of the role.
