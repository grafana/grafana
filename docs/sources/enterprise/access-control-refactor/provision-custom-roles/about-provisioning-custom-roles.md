---
title: 'About creating or updating custom roles using Grafana provisioning'
menuTitle: 'About provisioning custom roles'
description: 'xxx.'
aliases: [xxx]
weight: 10
keywords:
  - xxx
---

# About creating or updating custom roles using Grafana provisioning

You can create, change or remove [Custom roles]({{< relref "./roles.md#custom-roles" >}}) and create or remove [built-in role assignments]({{< relref "./roles.md#built-in-role-assignments" >}}), by adding one or more YAML configuration files in the [`provisioning/access-control/`]({{< relref "../../administration/configuration/#provisioning" >}}) directory.
Refer to [Grafana provisioning]({{< relref "../../administration/configuration/#provisioning" >}}) to learn more about provisioning.

If you want to manage roles and built-in role assignments by API, refer to the [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control/" >}}).

+++++++++++++++++++++++
Fine-grained access control determines _who_ has access (an `identity`), the actions they can perform, and on which _Grafana resource_ (`role`) they can act.
+++++++++++++++++++++++

++++++++++++
You can create, update and delete custom roles by using the [Access Control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by using [Grafana Provisioning]({{< relref "./provisioning.md" >}}).

By default, Grafana Server Admin has a [built-in role assignment]({{< ref "#built-in-role-assignments" >}}) which allows a user to create, update, or delete custom roles.
If a Grafana Server Admin wants to delegate that privilege to other users, they can create a custom role with relevant [permissions]({{< relref "./permissions.md" >}}) and `permissions:delegate` scope will allow those users to manage roles themselves.

Note that you won't be able to create, update or delete a custom role with permissions which you yourself do not have. For example, if the only permission you have is a `users:create`, you won't be able to create a role with other permissions.

### Custom role assignment

hidden roles
global roles

## Role scopes

A role can be either _global_ or _organization local_. _Global_ roles are not mapped to any specific organization and can be reused across multiple organizations, whereas _organization local_ roles are only available for that specific organization.