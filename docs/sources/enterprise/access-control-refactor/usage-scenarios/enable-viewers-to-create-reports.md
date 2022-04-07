---
title: 'Enable viewers to create reports'
menuTitle: 'Enable viewers to create reports'
description: 'xxx.'
aliases: [xxx]
weight: 30
keywords:
  - xxx
---

# Enable viewers to create reports

In order to create reports, you need to have `reports.admin:write` permission. By default, a Grafana Admin or organization Admin can create reports as there is a [built-in role assignment]({{< relref "./roles#built-in-role-assignments" >}}) which comes with `reports.admin:write` permission.

Before you get started, make sure to [enable fine-grained access control]({{< relref "./_index.md#enable-fine-grained-access-control" >}}).

If you want your users who have the `Viewer` organization role to create reports, you have two options:

1. Create a built-in role assignment and map the `fixed:reporting:admin:edit` fixed role to the `Viewer` built-in role. Note that the `fixed:reporting:admin:edit` fixed role allows doing more than creating reports. Refer to [fixed roles]({{< relref "./roles.md#fixed-roles" >}}) for full list of permission assignments.
1. [Create a custom role]({{< ref "#create-your-custom-role" >}}) with `reports.admin:write` permission, and create a built-in role assignment for `Viewer` organization role.
