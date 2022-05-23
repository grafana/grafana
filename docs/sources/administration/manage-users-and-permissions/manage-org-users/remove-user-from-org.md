+++
aliases = ["/docs/grafana/latest/administration/manage-users-and-permissions/manage-org-users/remove-user-from-org/"]
title = "Remove a user from an organization"
weight = 40
+++

# Remove a user from an organization

You can remove a user from an organization when they no longer require access to the dashboard or data sources owned by the organization. No longer requiring access to an organization might occur when the user has left your company or has internally moved to another organization.

This action does not remove the user account from the Grafana server.

## Before you begin

- Ensure you have organization administrator privileges

**To remove a user from an organization**:

1. Sign in to Grafana as an organization administrator.
1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Users**.
1. Find the user account that you want to remove from the organization.

   Use the search field to filter the list, if necessary.

1. Click the red **X** to remove the user from the organization.

> **Note:** If you have [server administrator]({{< relref "../about-users-and-permissions.md#grafana-server-administrators" >}}) permissions, you can also [remove a user from an organization]({{< relref "../../manage-users-and-permissions/manage-server-users/add-remove-user-to-org.md#remove-a-user-from-an-organization" >}}) on the Users page of the Server Admin section.
