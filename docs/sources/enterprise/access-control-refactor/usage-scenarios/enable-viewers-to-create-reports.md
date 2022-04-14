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

This topic describes how to enable viewers to create reports.

## Before you begin

- [Enable role-based access control]({{< relref "../enable-rbac.md" >}}).

**To enable viewers to create reports, perform one of the following:**

- Assign the `fixed:reporting:admin:edit` role to the `Viewer` basic role. For more information about assigning a fixed role to a basic role, refer to [Remove or restore a basic role using provisioning]({{< relref "../provision-custom-roles/remove-restore-basic-role.md" >}})

  > **Note:** The `fixed:reporting:admin:edit` role assigns more permissions than just creating reports. For more information about fixed role permission assignments, refer to [Role-based access control fixed role definitions]({{< relref "../rbac-fixed-role-definitions.md" >}}).

- [Create a custom role]({{< ref "./create-custom-role-using-http-api.md" >}}) that includes the `reports.admin:write` permission, and add the custom role to the `Viewer` basic role.
  - For more information about creating a custom role, refer to [Create, update, or delete a custom role using Grafana provisioning](../provision-custom-roles/create-update-delete-custom-role.md).
  - For more information about assigning a custom role to a basic role, refer to [Assign a custom role to a basic role]({{< relref "../provision-custom-roles/assigning-custom-roles.md" >}})
