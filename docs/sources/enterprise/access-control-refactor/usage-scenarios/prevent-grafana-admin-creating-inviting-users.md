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

This topic describes how to remove the `users:create` permissions from the Grafana Admin role, which prevents the Grafana Admin from creating users and inviting them to join an organization.

## Before you begin

- [Enable role-based access control]({{< relref "../enable-rbac.md" >}}).

**To prevent a user from creating and inviting users:**

1. [View basic role assignments]({{< relref "../basic-role-definitions.md" >}}) to determine which basic role assignments are available.
1. To determine which role provides `users:create` permission, refer to refer to [fixed roles]({{< relref "../rbac-fixed-role-definitions.md" >}}).
1. Use the [Role-based access control HTTP API]({{< relref "../../../http_api/access_control.md" >}}) or Grafana provisioning to [remove the basic role assignment]({{< relref "../provision-custom-roles/remove-restore-basic-role.md" >}}).
