+++
title = "Assign or remove Grafana server administrator privileges"
aliases = ["docs/sources/administration/manage-users-and-permissions/manage-server-users/assign-remove-server-admin-privileges.md"]
weight = 20
+++

# Assign or remove Grafana server administrator privileges

Grafana server administrator are responsible for creating users, organizations, and managing permissions. For more information about the server administration role, refer to [Grafana server administrators]({{< relref "../about-users-and-permissions/#grafana-server-administrators">}}).

<!--- Why create multiple admins? When to do this? -->

## Before you begin

- [Add a user]({{< relref "./add-user.md">}})
- Ensure you have Grafana server administrator privileges

**To assign or remove Grafana administrator privileges**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. In the **Grafana Admin** section, click **Change**.
1. Click **Yes** or **No**, depending on whether or not you want this user to have the Grafana server administrator role.
1. Click **Change**.

The system updates the user's permission the next time they log in.
