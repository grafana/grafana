+++
title = "Access control"
description = "Understand how to grant, change or revoke access to the Grafana resources"
keywords = ["grafana", "access-control", "enterprise"]
weight = 100
+++

# Access control

> The access control is currently in beta. Expect changes in future releases.

> Access control is available behind the `accesscontrol` feature flag in Grafana Enterprise 8.0+.

Access control provides a standardized way of granting, changing and revoking access to Grafana resources. 
The access control works hand-in-hand with the existing [permissions]({{< relref "../../permissions/_index.md" >}}) model and allows you to control actions your users can perform when they have one of the organization roles assigned to their account, or they are a Grafana Admin.

## How access control works

The access control work with the following main parts:
1. _who_ has access (`identity`). 
1. _what access_ they have and for which _Grafana resource_ (`role`).

Learn more about [Concepts]({{< relref "./concepts/_index.md" >}}) and understand how to [Manage roles and permissions]({{< relref "./managing-roles-permissions.md" >}}).
Refer to [how-to guides]({{< relref "./how-to-examples.md" >}}) for examples of using fine-grained roles and permissions.

### Identity

In access control you can grant, change or revoke access to _users_. You can do this by updating [permissions]({{< relref "./concepts/permissions.md" >}}) of [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) or Grafana Admin role.
Refer to [Managing roles and permissions]({{< relref "./managing-roles-permissions.md" >}}) to understand how to do that.

### Access management

When an authenticated user tries to access a Grafana resource, access control checks the required [permissions]({{< relref "./concepts/permissions.md" >}}) for the resource and determines whether the action is allowed or not.

### Resources

If a user needs access to a specific Grafana resource, you can assign a role with required permissions to the relevant Organization role or Grafana Admin role.
Currently, only subset of resources can be controlled by fine-grained permissions. Refer to [Managing roles and permissions]({{< relref "./managing-roles-permissions.md" >}}) for more information.
