+++
title = "Concepts"
description = "Understand access control terms and concepts"
keywords = ["grafana", "access-control", "concepts", "roles", "permissions" "enterprise"]
weight = 190
+++

# Concepts

To leverage access control, you would need to manage [Roles]({{< relref "./roles.md" >}}) and [Permissions]({{< relref "./permissions.md" >}}). 
To understand how to work with the roles and permissions, refer to [Managing roles and permissions]({{< relref "../managing-roles-permissions.md" >}}).

## Roles

A role represents a set of permissions that allows you to perform specific actions on Grafana resources. See [Permissions]({{< relref "./permissions.md" >}}) to learn more about permissions and scopes.

There are three types of roles: 
1. [Predefined roles]({{< relref "./roles.md#predefined-roles" >}}), which provide granular access for specific resources within Grafana and are managed by the Grafana itself. All predefined roles start with a prefix “grafana:roles:” and can’t be changed or deleted by users.
1. [Custom roles]({{< relref "./custom-roles.md" >}}), which provide granular access based on the user specified set of permissions. A custom role with a prefix of “grafana:roles:” can’t be created as it is reserved for predefined roles.
1. [Built-in roles]({{< relref "./roles.md#built-in-roles" >}}), which are associations of predefined or custom roles to currently existing Grafana Server Admin and Admin, Editor, Viewer organization roles.

To see what built-in and predefined roles are available and which permissions are mapped to those roles, you can use an API to fetch the roles and look at the roles permissions.

### Role scopes

Roles can be either a global or local to organization. TODO

