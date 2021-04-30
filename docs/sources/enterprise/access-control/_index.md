+++
title = "Access control"
description = "Understand how to grant, change or revoke access to the Grafana resources"
keywords = ["grafana", "access-control", "enterprise"]
weight = 190
+++

# Access control

> **Note:** The access control is currently in beta. Expect changes in future releases.

Access control provides a standardized way of granting, changing and revoking access to Grafana resources. 
The access control works hand-in-hand with the existing permissions model and allows you to granularly manage actions your users can perform when they have one of the organization roles assigned to their account or they are a Grafana Server Admin.

## How access control works

The access control is managed by defining the following main parts:
1. _who_ has access (`identity`). 
1. _what access_ they have and for which _Grafana resource_ (`role`).

### Identity

In access control you can grant, change or revoke access to _users_. Currently, you can do this by updating the existing [Grafana permissions]({{< relref "../../permissions/_index.md" >}}) of [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) or Grafana Server Admin role.
Refer to [How-to]({{< relref "./how-to.md" >}}) guide to understand how you can do that.

### Access management

When an authenticated user tries to access a Grafana resource, access control checks the required permissions for the resource and determines whether the action is allowed by checking the associated role with the user.
Currently, only subset of resources are eligible for access control. See [Resources]{{< ref "#resources" >}} for more information.

Learn more about [Concepts]({{< relref "./concepts/_index.md" >}}) and refer to [Managing roles and permissions]({{< relref "./managing-roles-permissions.md" >}}) to understand how to manage access.

### Resources

If a user needs access to a specific Grafana resource, you can grant the user a role for that resource which has required permissions. 
For more information on what roles can be granted on which resource, refer to [Roles]({{< relref "./concepts/roles.md" >}})
