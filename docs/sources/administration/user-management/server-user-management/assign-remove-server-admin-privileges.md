---
aliases:
  - /docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/assign-remove-server-admin-privileges/
title: Assign or remove Grafana server administrator privileges
description: Describes how to assign and remove Grafana administrator privileges from a server user.
weight: 20
---

# Assign or remove Grafana server administrator privileges

Grafana server administrators are responsible for creating users, organizations, and managing permissions. For more information about the server administration role, refer to [Grafana server administrators]({{< relref "../../roles-and-permissions#grafana-server-administrators" >}}).

> **Note:** Server administrators are "super-admins" with full permissions to create, read, update, and delete all resources and users in all organizations, as well as update global settings such as licenses. Only grant this permission to trusted users.

## Before you begin

- [Add a user]({{< relref "../#add-a-user" >}})
- Ensure you have Grafana server administrator privileges

**To assign or remove Grafana administrator privileges**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. In the **Grafana Admin** section, click **Change**.
1. Click **Yes** or **No**, depending on whether or not you want this user to have the Grafana server administrator role.
1. Click **Change**.

The system updates the user's permission the next time they load a page in Grafana.
