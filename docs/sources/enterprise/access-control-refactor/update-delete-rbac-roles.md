---
title: 'Update RBAC roles'
menuTitle: 'Update RBAC roles'
description: 'xxx.'
aliases: [xxx]
weight: 60
keywords:
  - xxx
---

# Update RBAC roles

This topic shows you how to ...

## Remove fixed role from a basic role

Prose here on why and when a user would want to do this. What are the benefits?

### Before you begin

- Determine which basic role and fixed role you want to restore

**To remove a default basic or fixed role assignment:**

1. Open the YAML configuration file and locate the `removeDefaultAssignments` section.

1. Refer to the following table to add attributes and values.

| Attribute     | Description                       |
| ------------- | --------------------------------- |
| `builtInRole` | Enter the name of the basic role. |
| `fixedRole`   | Enter the name of the fixed role. |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example removes a basic and fixed role assignment.

```yaml
# config file version
apiVersion: 1

# list of default basic role assignments that should be removed
removeDefaultAssignments:
  - builtInRole: 'Grafana Admin'
    fixedRole: 'fixed:permissions:admin'
```

## Add a fixed role to a basic role

Prose here on why and when a user would want to do this. What are the benefits?

### Before you begin

- Determine which basic role and fixed role you want to restore

**To add a fixed role to a basic role:**

1. Open the YAML configuration file and locate the `addDefaultAssignments` section.

1. Refer to the following table to add attributes and values.

| Attribute     | Description                       |
| ------------- | --------------------------------- |
| `builtInRole` | Enter the name of the basic role. |
| `fixedRole`   | Enter the name of the fixed role. |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example restores a default basic and fixed role assignment.

```yaml
# config file version
apiVersion: 1

# list of default basic role assignments that should be added back
addDefaultAssignments:
  - builtInRole: 'Admin'
    fixedRole: 'fixed:reporting:admin:read'
```

## Delete a custom role using Grafana provisioning

Delete a custom role when you no longer need it. When you delete a custom role [impact statement here of what happends when a custom role is deleted.]

> **Note:** The system deletes roles identified in the `deleteRoles` section before it adds roles identified in the `roles` section.

### Before you begin

- Identify the role or roles that you want to delete.
- Ensure that you have access to the YAML configuration file.

**To delete a role a custom role:**

1. Open the YAML configuration file and locate the `deleteRoles` section.

1. Refer to the following table to add attributes and values.

   | Attribute | Description                                                                                                                            |
   | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | `name`    | The name of the custom role you want to delete. You can add a `uid` instead of a role name. The role `name` or the `uid` are required. |
   | `orgId`   | Identifies the organization to which the role belongs.                                                                                 |
   | `force`   | What does this do?                                                                                                                     |

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).

The following example deletes a custom role:

```yaml
# config file version
apiVersion: 1

# list of roles that should be deleted
deleteRoles:
  - name: custom:reports:editor
    orgId: 1
    force: true
```
