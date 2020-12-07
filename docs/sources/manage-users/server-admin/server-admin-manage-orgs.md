+++
title = "Server Admin - Manage organization"
type = "docs"
weight = 100
+++

# Manage organizations as a Server Admin

This topic explains organization management tasks performed by Grafana Server Admins.

In order to perform any of these tasks, you must be logged in to Grafana on an account with Grafana Server Admin permissions. For more information about Grafana Admin permissions, refer to [Grafana Server Admin role]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}})

> **Note:** The Grafana Server Admin role does not exist in Grafana Cloud. Grafana Cloud users cannot perform tasks listed in this section.

## View organization list

See a complete list of organizations set up on your Grafana server.

1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears.
1. Click **Orgs**.

Grafana displays all organizations set up on the server, listed in alphabetical order by organization name. The following information is displayed:
- **Id -** The ID number of the organization.
- **Name -** The name of the organization.

<img src="/img/docs/manage-users/server-org-list-7-3.png" max-width="1200px">

## Create organization

Add an organization to your Grafana server.

1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears.
1. Click **Orgs**.
1. Click **+ New org**.
1. Enter the name of the new organization and then click **Create**.

Two things happen:
- Grafana creates a new organization with you as the sole member and Admin.
- Grafana opens the new organization [Preferences tab]({{< relref "/administration/preferences.md" >}}).

You can now add users or perform other [Organization Admin tasks]({{< relref /org-admin/_index.md"" >}}).

## Delete organization

Permanently remove an organization from your Grafana server.

**Warning:** Deleting the organization also deletes all teams and dashboards for this organization.

1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears.
1. Click **Orgs**.
1. Click the red **X** next to the organization that you want to remove.
1. Click **Delete**.

## Edit an organization

Grafana Server Admins can perform some organization management tasks that are almost identical to Organization Admin tasks, just accessed from a different menu path.

![Server admin Edit Organization](/img/docs/manage-users/server-admin-edit-org-7-3.png)

### Change organization name

1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears.
1. Click **Orgs**.
1. Click the name of the organization that you want to edit.

### Change organization member role


Almost identical user mgmt tasks as org admin when they drill down to the organization page via Server Admin
