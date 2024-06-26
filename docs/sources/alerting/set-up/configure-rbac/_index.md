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

Role-based access control (RBAC) for Grafana Enterprise and Grafana Cloud provides a standardized way of granting, changing, and revoking access, so that users can view and modify Grafana resources.

A user is any individual who can log in to Grafana. Each user is associated with a role that includes permissions. Permissions determine the tasks a user can perform in the system.

Each permission contains one or more actions and a scope.

## Permissions

Grafana Alerting has the following permissions.

| Action                                | Applicable scope                       | Description                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alert.instances.external:read`       | `datasources:*`<br>`datasources:uid:*` | Read alerts and silences in data sources that support alerting.                                                                                                                                                     |
| `alert.instances.external:write`      | `datasources:*`<br>`datasources:uid:*` | Manage alerts and silences in data sources that support alerting.                                                                                                                                                   |
| `alert.instances:create`              | n/a                                    | Create silences in the current organization.                                                                                                                                                                        |
| `alert.instances:read`                | n/a                                    | Read alerts and silences in the current organization.                                                                                                                                                               |
| `alert.instances:write`               | n/a                                    | Update and expire silences in the current organization.                                                                                                                                                             |
| `alert.notifications.external:read`   | `datasources:*`<br>`datasources:uid:*` | Read templates, contact points, notification policies, and mute timings in data sources that support alerting.                                                                                                      |
| `alert.notifications.external:write`  | `datasources:*`<br>`datasources:uid:*` | Manage templates, contact points, notification policies, and mute timings in data sources that support alerting.                                                                                                    |
| `alert.notifications:write`           | n/a                                    | Manage templates, contact points, notification policies, and mute timings in the current organization.                                                                                                              |
| `alert.notifications:read`            | n/a                                    | Read all templates, contact points, notification policies, and mute timings in the current organization.                                                                                                            |
| `alert.rules.external:read`           | `datasources:*`<br>`datasources:uid:*` | Read alert rules in data sources that support alerting (Prometheus, Mimir, and Loki)                                                                                                                                |
| `alert.rules.external:write`          | `datasources:*`<br>`datasources:uid:*` | Create, update, and delete alert rules in data sources that support alerting (Mimir and Loki).                                                                                                                      |
| `alert.rules:create`                  | `folders:*`<br>`folders:uid:*`         | Create Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder and `datasources:query` in the scope of data sources the user can query. |
| `alert.rules:delete`                  | `folders:*`<br>`folders:uid:*`         | Delete Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder and `datasources:query` in the scope of data sources the user can query. |
| `alert.rules:read`                    | `folders:*`<br>`folders:uid:*`         | Read Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder.                                                                           |
| `alert.rules:write`                   | `folders:*`<br>`folders:uid:*`         | Update Grafana alert rules in a folder and its subfolders. Combine this permission with `folders:read` in a scope that includes the folder and `datasources:query` in the scope of data sources the user can query. |
| `alert.silences:create`               | `folders:*`<br>`folders:uid:*`         | Create rule-specific silences in a folder and its subfolders.                                                                                                                                                       |
| `alert.silences:read`                 | `folders:*`<br>`folders:uid:*`         | Read general and rule-specific silences in a folder and its subfolders.                                                                                                                                             |
| `alert.silences:write`                | `folders:*`<br>`folders:uid:*`         | Update and expire rule-specific silences in a folder and its subfolders.                                                                                                                                            |
| `alert.provisioning:read`             | n/a                                    | Read all Grafana alert rules, notification policies, etc via provisioning API. Permissions to folders and data source are not required.                                                                             |
| `alert.provisioning.secrets:read`     | n/a                                    | Same as `alert.provisioning:read` plus ability to export resources with decrypted secrets.                                                                                                                          |
| `alert.provisioning:write`            | n/a                                    | Update all Grafana alert rules, notification policies, etc via provisioning API. Permissions to folders and data source are not required.                                                                           |
| `alert.provisioning.provenance:write` | n/a                                    | Set provisioning status for alerting resources. Cannot be used alone. Requires user to have permissions to access resources                                                                                         |

To help plan your RBAC rollout strategy, refer to [Plan your RBAC rollout strategy](https://grafana.com/docs/grafana/next/administration/roles-and-permissions/access-control/plan-rbac-rollout-strategy/).
