---
title: 'Prevent a Grafana Admin from creating and inviting users'
menuTitle: 'Prevent a Grafana Admin from creating and inviting users'
description: 'xxx.'
aliases: [xxx]
weight: 40
keywords:
  - xxx
---

# Prevent a Grafana Admin from creating and inviting users

In order to create users, you need to have `users:create` permission. By default, a user with the Grafana Admin role can create users as there is a [built-in role assignment]({{< relref "./roles#built-in-role-assignments" >}}) which comes with `users:create` permission.

Before you get started, make sure to [enable fine-grained access control]({{< relref "./_index.md#enable-fine-grained-access-control" >}}).

If you want to prevent Grafana Admin from creating users, you can do the following:

1. [Check all built-in role assignments]({{< ref "#check-all-built-in-role-assignments" >}}) to see what built-in role assignments are available.
1. From built-in role assignments, find the role which gives `users:create` permission. Refer to [fixed roles]({{< relref "./roles.md#fixed-roles" >}}) for full list of permission assignments.
1. Remove the built-in role assignment by using an [Fine-grained access control HTTP API]({{< relref "../../http_api/access_control.md" >}}) or by using [Grafana provisioning]({{< relref "./provisioning" >}}).
