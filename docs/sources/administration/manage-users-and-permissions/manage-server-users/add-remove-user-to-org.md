+++
aliases = ["/docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/add-remove-user-to-org/", "/docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/add-user-to-org/"]
title = "Add or remove a user from an organization"
weight = 30
+++

# Add a user to an organization

Add a user to an organization when you want the user to have access to organization resources such as dashboards, data sources, and playlists. A user must belong to at least one organization.

You are required to specify an Admin role for each organization. The first user you add to an organization becomes the Admin by default. After you assign the Admin role to a user, you can add other users to an organization as either Admins, Editors, or Viewers.

## Before you begin

- [Create an organization]({{< relref "../../manage-organizations/_index.md" >}})
- [Add a user]({{< relref "./add-user.md" >}}) to Grafana
- Ensure you have Grafana server administrator privileges

**To add a user to an organization**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. In the **Organizations** section, click **Add user to organization**.
1. Select an organization and a role.

   For more information about user permissions, refer to [Organization roles]({{< relref "../about-users-and-permissions/#organization-roles" >}}).

1. Click **Add to organization**.

The next time the user signs in, they will be able to navigate to their new organization using the Switch Organizations option in the user profile menu.

> **Note:** If you have [organization administrator]({{< relref "../about-users-and-permissions.md#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../about-users-and-permissions.md#grafana-server-administrators" >}}) permissions, you can still [invite a user to join an organization]({{< relref "../../manage-users-and-permissions/manage-org-users/invite-user-join-org.md" >}}).

# Remove a user from an organization

Remove a user from an organization when they no longer require access to the dashboards, data sources, or alerts in that organization.

## Before you begin

- Ensure you have Grafana server administrator privileges

**To remove a user from an organization**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. In the **Organization** section, click **Remove from organization** next to the organization from which you want to remove the user.
1. Click **Confirm removal**.

> **Note:** If you have [organization administrator]({{< relref "../about-users-and-permissions.md#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../about-users-and-permissions.md#grafana-server-administrators" >}}) permissions, you can still [remove a user from an organization]({{< relref "../../manage-users-and-permissions/manage-org-users/remove-user-from-org.md" >}}) in the Users section of organization configuration.
