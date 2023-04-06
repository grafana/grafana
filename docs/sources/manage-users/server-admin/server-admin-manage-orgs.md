+++
title = "Manage organization"
weight = 200
+++

# Manage organizations as a Server Admin

This topic explains organization management tasks performed by Grafana Server Admins.

In order to perform any of these tasks, you must be logged in to Grafana on an account with Grafana Server Admin permissions. For more information about Grafana Admin permissions, refer to [Grafana Server Admin role]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}})

> **Note:** The Grafana Server Admin role does not exist in Grafana Cloud. Grafana Cloud users cannot perform tasks listed in this section.

## View organization list

See a complete list of organizations set up on your Grafana server.

{{< docs/shared "manage-users/view-server-org-list.md" >}}

Grafana displays all organizations set up on the server, listed in alphabetical order by organization name. The following information is displayed:

- **Id -** The ID number of the organization.
- **Name -** The name of the organization.

![Server Admin organization list](/static/img/docs/manage-users/server-org-list-7-3.png)

## Create organization

Add an organization to your Grafana server.

{{< docs/list >}}

{{< docs/shared "manage-users/view-server-org-list.md" >}}

1. Click **+ New org**.
1. Enter the name of the new organization and then click **Create**.

{{< /docs/list >}}

Two things happen:

- Grafana creates a new organization with you as the sole member and Admin.
- Grafana opens the new organization [Preferences tab]({{< relref "../../administration/preferences/_index.md" >}}).

You can now add users or perform other Organization Admin tasks.

## Delete organization

Permanently remove an organization from your Grafana server.

**Warning:** Deleting the organization also deletes all teams and dashboards for this organization.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list.md" >}}

1. Click the red **X** next to the organization that you want to remove.
1. Click **Delete**.
   {{< /docs/list >}}

## Edit an organization

Grafana Server Admins can perform some organization management tasks that are almost identical to Organization Admin tasks, just accessed from a different menu path.

![Server admin Edit Organization](/static/img/docs/manage-users/server-admin-edit-org-7-3.png)

### View organization members and roles

See which user accounts are assigned to the organization and their assigned roles.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list.md" >}}

1. Click the name of the organization for which you want to view members.
1. Scroll down to the Organization Users section. User accounts are displayed in alphabetical order.
   {{< /docs/list >}}

### Change organization name

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list-and-edit.md" >}}

1. In the **Name** field, type the new organization name.
1. Click **Update**.
   {{< /docs/list >}}

### Change organization member role

Change the organization role assigned to a user account that is assigned to the organization you are editing.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list-and-edit.md" >}}

1. In the Organization Users section, locate the user account that you want to change the role of.
1. In the **Role** field, select the new role that you want to assign.
   {{< /docs/list >}}

## Remove a user from an organization

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-org-list-and-edit.md" >}}

1. In the Organization Users section, locate the user account that you want to change the role of.
1. Click the red **X** next to the user account listing and then click **Delete**.
   {{< /docs/list >}}
