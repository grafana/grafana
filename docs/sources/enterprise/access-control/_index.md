+++
title = "Fine-grained access control"
description = "Understand how to grant, change or revoke access to the Grafana resources"
keywords = ["grafana", "fine-grained-access-control", "roles", "permissions", "enterprise"]
weight = 100
+++

# Fine-grained access control

> **Note:** Fine-grained access control is currently in beta. Expect changes in future releases.

Fine-grained access control provides a standardized way of granting, changing, and revoking access to view and modify Grafana resources, like users and reports. 
Fine-grained access control works hand-in-hand with the existing [Grafana permissions]({{< relref "../../permissions/_index.md" >}}) and allows you to control actions users can perform in a more granular way.

To learn more about how fine-grained access control works, refer to [Roles]({{< relref "./roles.md" >}}) and [Permissions]({{< relref "./permissions.md" >}}).
Refer to [fine-grained access control usage scenarios]({{< relref "./usage-scenarios.md" >}}) to see step-by-step instructions and understand how you can use the fine-grained access control system.

## Enable fine-grained access control

Fine-grained access control is available behind the `accesscontrol` [feature toggle]({{< relref "../../administration/configuration.md#feature_toggles" >}}) in Grafana Enterprise 8.0+.
Refer to [Configuration]({{< relref "../../administration/configuration.md" >}}) to understand how you can enable it in different environments.

## Access management

When making a decision about access, the fine-grained access control takes into the account the following main parts:
- _who_ has an access (`identity`).
- _what they can do_ and on which _Grafana resource_ (`role`).

You can grant, change, or revoke access to _users_ (`identity`). When an authenticated user tries to access a Grafana resource, the authorization system checks the required [fine-grained permissions]({{< relref "./permissions.md" >}}) for the resource and determines whether the action is allowed or not. 

To grant or revoke access to your users, you can create or remove a [built-in role assignments]({{< relref "./roles.md#built-in-role-assignments" >}}).

## Resources with fine-grained permissions

Fine-grained access control is in beta and [permissions]({{< relref "./permissions.md" >}}) are available only for a subset of resources.
Refer to the relevant API guide from below list to learn more about specific endpoints where you can use access control.

- [Access Control API]({{< relref "../../http_api/access_control.md" >}})
- [Admin API]({{< relref "../../http_api/admin.md" >}})
- [Organization API]({{< relref "../../http_api/org.md" >}})
- [Reporting API]({{< relref "../../http_api/reporting.md" >}})
- [User API]({{< relref "../../http_api/user.md" >}})
