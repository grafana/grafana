+++
title = "Fine-grained Access control"
description = "Understand how to grant, change or revoke access to the Grafana resources"
keywords = ["grafana", "fine-grained-access-control", "roles", "permissions", "enterprise"]
weight = 100
+++

# Fine-grained access control

> The fine-grained access control is currently in beta. Expect changes in future releases.

> Fine-grained access control is available behind the `accesscontrol` feature flag in Grafana Enterprise 8.0+.

Fine-grained access control provides a standardized way of granting, changing and revoking access to Grafana resources. 
The fine-grained access control works hand-in-hand with the existing [Grafana permissions]({{< relref "../../permissions/_index.md" >}}) and allows you to control actions users can perform in a granular way.

To learn more about how fine-grained access control works, refer to [Concepts]({{< relref "./concepts/_index.md" >}}) and to [Manage roles and permissions]({{< relref "./managing-roles-permissions.md" >}}).
[How-to guides]({{< relref "./how-to-examples.md" >}}) contain examples of using fine-grained roles and permissions.

## Access management

When making a decision about access, the fine-grained access control takes into the account the following main parts:
1. _who_ has an access (`identity`).
1. _what they can do_ and on which _Grafana resource_ (`role`).

You can grant, change or revoke access to _users_ (`identity`). When an authenticated user tries to access a Grafana resource, the authorization system checks the required [fine-grained permissions]({{< relref "./concepts/permissions.md" >}}) for the resource and determines whether the action is allowed or not. 

To grant or revoke access to your users, you can assign a [Predefined role]({{< relref "./concepts/roles.md" >}}) or a [Custom role]({{< relref "./concepts/custom-roles.md" >}}) with relevant [fine-grained permissions]({{< relref "./concepts/permissions.md" >}}) either to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}) or to [Grafana Admin role]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}}). Refer to [Managing roles and permissions]({{< relref "./managing-roles-permissions.md" >}}) for more information.
