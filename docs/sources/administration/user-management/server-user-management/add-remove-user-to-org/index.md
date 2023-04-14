---
aliases:
  - ../../manage-users-and-permissions/manage-server-users/add-remove-user-to-org/
  - ../../manage-users-and-permissions/manage-server-users/add-user-to-org/
description: Describes how a Grafana server administrator can add or remove users
  in an organization
title: Add or remove a user in an organization
weight: 30
---

# Add or remove a user in an organization

Server administrators can add and remove users in organizations. To do this as an organization administrator, see [Manage users in an organization]({{< relref "../../manage-org-users/" >}}).

## Add a user to an organization

Add a user to an organization when you want the user to have access to organization resources such as dashboards, data sources, and playlists. A user must belong to at least one organization.

You are required to specify an Admin role for each organization. The first user you add to an organization becomes the Admin by default. After you assign the Admin role to a user, you can add other users to an organization as either Admins, Editors, or Viewers.

### Before you begin

- [Create an organization]({{< relref "../../../organization-management/#create-an-organization" >}})
- [Add a user]({{< relref "./#add-a-user" >}}) to Grafana
- Ensure you have [Grafana server administrator privileges]({{< relref "./assign-remove-server-admin-privileges" >}})

**To add a user to an organization**:

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, and then **Users**.
1. Click a user.
1. In the Organizations section, click **Add user to organization**.
1. Select an organization and a role.

   For more information about user permissions, refer to [Organization roles]({{< relref "../../../roles-and-permissions#organization-roles" >}}).

1. Click **Add to organization**.

The next time the user signs in, they will be able to navigate to their new organization using the Switch Organizations option in the user profile menu.

> **Note:** If you have [organization administrator]({{< relref "../../../roles-and-permissions#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../../../roles-and-permissions#grafana-server-administrators" >}}) permissions, you can still [invite a user to join an organization]({{< relref "../../manage-org-users#invite-a-user-to-join-an-organization" >}}).

## Remove a user from an organization

Remove a user from an organization when they no longer require access to the dashboards, data sources, or alerts in that organization.

### Before you begin

- Ensure you have Grafana server administrator privileges

**To remove a user from an organization**:

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, and then **Users**.
1. Click a user.
1. In the Organization section, click **Remove from organization** next to the organization from which you want to remove the user.
1. Click **Confirm removal**.

> **Note:** If you have [organization administrator]({{< relref "../../../roles-and-permissions#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../../../roles-and-permissions#grafana-server-administrators" >}}) permissions, you can still [remove a user from an organization]({{< relref "../../manage-org-users#remove-a-user-from-an-organization" >}}) in the Users section of organization configuration.
