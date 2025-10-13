---
aliases:
  - ../../../enterprise/access-control/configure-rbac/
description: Learn how to configure RBAC.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure RBAC
title: Configure RBAC in Grafana
weight: 30
---

# Configure RBAC in Grafana

{{% admonition type="note" %}}
Available in [Grafana Enterprise](/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud).
{{% /admonition %}}

The table below describes all RBAC configuration options. Like any other Grafana configuration, you can apply these options as [environment variables](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#override-configuration-with-environment-variables).

| Setting                         | Required | Description                                                                                                                                                                                                                                                                                                                     | Default |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `permission_cache`              | No       | Enable to use in memory cache for loading and evaluating users' permissions.                                                                                                                                                                                                                                                    | `true`  |
| `permission_validation_enabled` | No       | Grafana enforces validation for permissions when a user creates or updates a role. The system checks the internal list of scopes and actions for each permission to determine they are valid. By default, if a scope or action is not recognized, Grafana logs a warning message. When set to `true`, Grafana returns an error. | `true`  |
| `reset_basic_roles`             | No       | Reset Grafana's basic roles' (Viewer, Editor, Admin, Grafana Admin) permissions to their default. Warning, if this configuration option is left to `true` this will be done on every reboot.                                                                                                                                    | `true`  |

## Example RBAC configuration

```bash
[rbac]

permission_cache = true
```
