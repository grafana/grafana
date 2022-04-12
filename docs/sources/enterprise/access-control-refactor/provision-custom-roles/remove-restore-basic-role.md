---
title: 'Remove or restore a basic role using Grafana provisioning'
menuTitle: 'Remove or restore a basic role'
description: 'xxx.'
aliases: [xxx]
weight: 50
keywords:
  - xxx
---

# Remove or restore a basic role using provisioning

You can remove and later restore those assignments with provisioning.

## Remove a default basic or fixed role assignment

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

## Restore a default basic or fixed role assignment

Prose here on why and when a user would want to do this. What are the benefits?

### Before you begin

- Determine which basic role and fixed role you want to restore

**To restore a default basic or fixed role assignment:**

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
