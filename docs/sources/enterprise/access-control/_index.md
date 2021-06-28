+++
title = "Fine-grained access control"
description = "Grant, change, or revoke access to Grafana resources"
keywords = ["grafana", "fine-grained-access-control", "roles", "permissions", "enterprise"]
weight = 100
+++

# Fine-grained access control

> **Note:** Fine-grained access control is in beta, and you can expect changes in future releases.

Fine-grained access control provides a standardized way of granting, changing, and revoking access when it comes to viewing and modifying Grafana resources, such as users and reports. 
Fine-grained access control works alongside the current [Grafana permissions]({{< relref "../../permissions/_index.md" >}}), and it allows you granular control of users’ actions.

To learn more about how fine-grained access control works, refer to [Roles]({{< relref "./roles.md" >}}) and [Permissions]({{< relref "./permissions.md" >}}).
To use the fine-grained access control system, refer to [Fine-grained access control usage scenarios]({{< relref "./usage-scenarios.md" >}}).

## Access management

Fine-grained access control considers a) _who_ has an access (`identity`), and b) _what they can do_ and on which _Grafana resource_ (`role`).

You can grant, change, or revoke access to _users_ (`identity`). When an authenticated user tries to access a Grafana resource, the authorization system checks the required fine-grained permissions for the resource and determines whether or not the action is allowed. Refer to [Fine-grained permissions]({{< relref "./permissions.md" >}}) for a complete list of available permissions.

To grant or revoke access to your users, create or remove built-in role assignments. For more information, refer to [Built-in role assignments]({{< relref "./roles.md#built-in-role-assignments" >}}).

## Resources with fine-grained permissions

Fine-grained access control is currently available for [Reporting]({{< relref "../reporting.md" >}}) and [Managing Users]({{< relref "../../manage-users/_index.md" >}}).
To learn more about specific endpoints where you can use access control, refer to [Permissions]({{< relref "./permissions.md" >}}) and to the relevant API guide:

- [Fine-grained access control API]({{< relref "../../http_api/access_control.md" >}})
- [Admin API]({{< relref "../../http_api/admin.md" >}})
- [Organization API]({{< relref "../../http_api/org.md" >}})
- [Reporting API]({{< relref "../../http_api/reporting.md" >}})
- [User API]({{< relref "../../http_api/user.md" >}})

## Enable fine-grained access control

Fine-grained access control is available behind the `accesscontrol` feature toggle in Grafana Enterprise 8.0+.
You can enable it either in a [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}) or by [configuring an environment variable]({{< relref "../../administration/configuration/#configure-with-environment-variables" >}}).

### Enable in config file

In your [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}), add `accesscontrol` as a [feature_toggle]({{< relref "../../administration/configuration.md#feature_toggle" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = accesscontrol
```

### Enable with an environment variable

You can use `GF_FEATURE_TOGGLES_ENABLE = accesscontrol` environment variable to override the config file configuration and enable fine-grained access control.

Refer to [Configuring with environment variables]({{< relref "../../administration/configuration.md#configure-with-environment-variables" >}}) for more information.

### Verify if enabled

You can verify if fine-grained access control is enabled or not by sending an HTTP request to the [Check endpoint]({{< relref "../../http_api/access_control.md#check-if-enabled" >}}).
