---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-rbac/
description: Configure RBAC for Grafana Alerting
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - RBAC
labels:
  products:
    - enterprise
    - cloud
title: Configure RBAC
weight: 155
---

# Configure RBAC

[Role-based access control (RBAC)](/docs/grafana/latest/administration/roles-and-permissions/access-control/plan-rbac-rollout-strategy/) for Grafana Enterprise and Grafana Cloud provides a standardized way of granting, changing, and revoking access, so that users can view and modify Grafana resources.

A user is any individual who can log in to Grafana. Each user has a role that includes permissions. Permissions determine the tasks a user can perform in the system.

Each permission contains one or more actions and a scope.

## Role types

Grafana has three types of roles for managing access:

- **Basic roles**: Admin, Editor, Viewer, and No basic role. These are assigned to users and provide default access levels.
- **Fixed roles**: Predefined groups of permissions for specific use cases. Basic roles automatically include certain fixed roles.
- **Custom roles**: User-defined roles that combine specific permissions for granular access control.

## Basic role permissions

The following table summarizes the default alerting permissions for each basic role.

| Capability                                | Admin | Editor | Viewer |
| ----------------------------------------- | :---: | :----: | :----: |
| View alert rules                          |   ✓   |   ✓    |   ✓    |
| Create, edit, and delete alert rules      |   ✓   |   ✓    |        |
| View silences                             |   ✓   |   ✓    |   ✓    |
| Create, edit, and expire silences         |   ✓   |   ✓    |        |
| View contact points and templates         |   ✓   |   ✓    |   ✓    |
| Create, edit, and delete contact points   |   ✓   |   ✓    |        |
| View notification policies                |   ✓   |   ✓    |   ✓    |
| Create, edit, and delete policies         |   ✓   |   ✓    |        |
| View mute timings                         |   ✓   |   ✓    |   ✓    |
| Create, edit, and delete timing intervals |   ✓   |   ✓    |        |
| View alert enrichments                    |   ✓   |   ✓    |   ✓    |
| Create, edit, and delete enrichments      |   ✓   |   ✓    |        |
| Access provisioning API                   |   ✓   |   ✓    |        |
| Export with decrypted secrets             |   ✓   |        |        |

{{< admonition type="note" >}}
Access to alert rules also requires permission to read the folder containing the rules and permission to query the data sources used in the rules.
{{< /admonition >}}

## Permissions

Grafana Alerting has the following permissions organized by resource type.

### Alert rules

Permissions for managing Grafana-managed alert rules.

| Action               | Applicable scope               | Description                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alert.rules:create` | `folders:*`<br>`folders:uid:*` | Create Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder and `datasources:query` in the scope of data sources the user can query.                               |
| `alert.rules:read`   | `folders:*`<br>`folders:uid:*` | Read Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder.                                                                                                         |
| `alert.rules:write`  | `folders:*`<br>`folders:uid:*` | Update Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder. To allow query modifications add `datasources:query` in the scope of data sources the user can query. |
| `alert.rules:delete` | `folders:*`<br>`folders:uid:*` | Delete Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder.                                                                                                       |

### External alert rules

Permissions for managing alert rules in external data sources that support alerting.

| Action                       | Applicable scope                       | Description                                                                                    |
| ---------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `alert.rules.external:read`  | `datasources:*`<br>`datasources:uid:*` | Read alert rules in data sources that support alerting (Prometheus, Mimir, and Loki).          |
| `alert.rules.external:write` | `datasources:*`<br>`datasources:uid:*` | Create, update, and delete alert rules in data sources that support alerting (Mimir and Loki). |

### Alert instances and silences

Permissions for managing alert instances and silences in Grafana.

| Action                   | Applicable scope               | Description                                                                          |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| `alert.instances:read`   | n/a                            | Read alerts and silences in the current organization.                                |
| `alert.instances:create` | n/a                            | Create silences in the current organization.                                         |
| `alert.instances:write`  | n/a                            | Update and expire silences in the current organization.                              |
| `alert.silences:read`    | `folders:*`<br>`folders:uid:*` | Read all general silences and rule-specific silences in a folder and its subfolders. |
| `alert.silences:create`  | `folders:*`<br>`folders:uid:*` | Create rule-specific silences in a folder and its subfolders.                        |
| `alert.silences:write`   | `folders:*`<br>`folders:uid:*` | Update and expire rule-specific silences in a folder and its subfolders.             |

### External alert instances

Permissions for managing alert instances in external data sources.

| Action                           | Applicable scope                       | Description                                                       |
| -------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `alert.instances.external:read`  | `datasources:*`<br>`datasources:uid:*` | Read alerts and silences in data sources that support alerting.   |
| `alert.instances.external:write` | `datasources:*`<br>`datasources:uid:*` | Manage alerts and silences in data sources that support alerting. |

### Contact points

Permissions for managing contact points (notification receivers).

| Action                                       | Applicable scope                                        | Description                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `alert.notifications.receivers:list`         | n/a                                                     | List contact points in the current organization.                                                                            |
| `alert.notifications.receivers:read`         | `receivers:*`<br>`receivers:uid:*`                      | Read contact points.                                                                                                        |
| `alert.notifications.receivers.secrets:read` | `receivers:*`<br>`receivers:uid:*`                      | Export contact points with decrypted secrets.                                                                               |
| `alert.notifications.receivers:create`       | n/a                                                     | Create a new contact points. The creator is automatically granted full access to the created contact point.                 |
| `alert.notifications.receivers:write`        | `receivers:*`<br>`receivers:uid:*`                      | Update existing contact points.                                                                                             |
| `alert.notifications.receivers:delete`       | `receivers:*`<br>`receivers:uid:*`                      | Update and delete existing contact points.                                                                                  |
| `alert.notifications.receivers:test`         | n/a                                                     | Test contact points to verify their configuration. Deprecated. Use "alert.notifications.receivers.test:create"              |
| `alert.notifications.receivers.test:create`  | `receivers:*`<br>`receivers:uid:*`<br>`receivers:uid:-` | Test contact points to verify their configuration. Use scope `receivers:uid:-` to grant permission to test new integrations |
| `receivers.permissions:read`                 | `receivers:*`<br>`receivers:uid:*`                      | Read permissions for contact points.                                                                                        |
| `receivers.permissions:write`                | `receivers:*`<br>`receivers:uid:*`                      | Manage permissions for contact points.                                                                                      |

### Notification policies

Permissions for managing notification policies (routing rules).

| Action                             | Applicable scope | Description                                           |
| ---------------------------------- | ---------------- | ----------------------------------------------------- |
| `alert.notifications.routes:read`  | n/a              | Read notification policies.                           |
| `alert.notifications.routes:write` | n/a              | Create new, update, and delete notification policies. |

### Time intervals

Permissions for managing mute time intervals.

| Action                                      | Applicable scope | Description                                        |
| ------------------------------------------- | ---------------- | -------------------------------------------------- |
| `alert.notifications.time-intervals:read`   | n/a              | Read mute time intervals.                          |
| `alert.notifications.time-intervals:write`  | n/a              | Create new or update existing mute time intervals. |
| `alert.notifications.time-intervals:delete` | n/a              | Delete existing time intervals.                    |

### Templates

Permissions for managing notification templates.

| Action                                     | Applicable scope | Description                                                                     |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------- |
| `alert.notifications.templates:read`       | n/a              | Read templates.                                                                 |
| `alert.notifications.templates:write`      | n/a              | Create new or update existing templates.                                        |
| `alert.notifications.templates:delete`     | n/a              | Delete existing templates.                                                      |
| `alert.notifications.templates.test:write` | n/a              | Test templates with custom payloads (preview and payload editor functionality). |

### General notifications

Legacy permissions for managing all notification resources.

| Action                      | Applicable scope | Description                                                                                              |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `alert.notifications:read`  | n/a              | Read all templates, contact points, notification policies, and mute timings in the current organization. |
| `alert.notifications:write` | n/a              | Manage templates, contact points, notification policies, and mute timings in the current organization.   |

### External notifications

Permissions for managing notification resources in external data sources.

| Action                               | Applicable scope                       | Description                                                                                                      |
| ------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `alert.notifications.external:read`  | `datasources:*`<br>`datasources:uid:*` | Read templates, contact points, notification policies, and mute timings in data sources that support alerting.   |
| `alert.notifications.external:write` | `datasources:*`<br>`datasources:uid:*` | Manage templates, contact points, notification policies, and mute timings in data sources that support alerting. |

### Provisioning

Permissions for managing alerting resources via the provisioning API.

| Action                                   | Applicable scope | Description                                                                                                                                                        |
| ---------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alert.provisioning:read`                | n/a              | Read all Grafana alert rules, notification policies, etc via provisioning API. Permissions to folders and data source are not required.                            |
| `alert.provisioning.secrets:read`        | n/a              | Same as `alert.provisioning:read` plus ability to export resources with decrypted secrets.                                                                         |
| `alert.provisioning:write`               | n/a              | Update all Grafana alert rules, notification policies, etc via provisioning API. Permissions to folders and data source are not required.                          |
| `alert.rules.provisioning:read`          | n/a              | Read Grafana alert rules via provisioning API. More specific than `alert.provisioning:read`.                                                                       |
| `alert.rules.provisioning:write`         | n/a              | Create, update, and delete Grafana alert rules via provisioning API. More specific than `alert.provisioning:write`.                                                |
| `alert.notifications.provisioning:read`  | n/a              | Read notification resources (contact points, notification policies, templates, time intervals) via provisioning API. More specific than `alert.provisioning:read`. |
| `alert.notifications.provisioning:write` | n/a              | Create, update, and delete notification resources via provisioning API. More specific than `alert.provisioning:write`.                                             |
| `alert.provisioning.provenance:write`    | n/a              | Set provisioning status for alerting resources. Cannot be used alone. Requires user to have permissions to access resources.                                       |

### Alert enrichments

Permissions for managing alert enrichments.

| Action                    | Applicable scope | Description                                                                             |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `alert.enrichments:read`  | n/a              | Read alert enrichment configurations in the current organization.                       |
| `alert.enrichments:write` | n/a              | Create, update, and delete alert enrichment configurations in the current organization. |

To help plan your RBAC rollout strategy, refer to [Plan your RBAC rollout strategy](https://grafana.com/docs/grafana/next/administration/roles-and-permissions/access-control/plan-rbac-rollout-strategy/).
