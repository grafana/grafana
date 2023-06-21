---
aliases:
  - ../manage-users/server-admin/
  - ../manage-users/server-admin/server-admin-manage-orgs/
  - manage-organizations/
description: Describes how to use organizations to isolate dashboard to users and
  teams.
keywords:
  - organizations
  - dashboards
menuTitle: Manage organizations
title: Manage organizations
weight: 200
---

# Manage organizations

This topic describes what organizations are, and how to create, edit, and delete them.

## About organizations

An organization is an entity that helps you isolate users and resources such as dashboards, annotations, and data sources from each other. Their purpose is to provide completely separate experiences, which look like multiple instances of Grafana, within a single instance. Multiple organizations are easier and cheaper to manage than multiple instances of Grafana.

Users, configuration settings, and Grafana Enterprise licenses are shared between organizations. Other resources, like dashboards, data sources, annotations, folders, Teams, and Alerts, are isolated within each organization and cannot be easily shared with another organization.

The following table summarizes the resources you can share and/or isolate using organizations.

| Resource                 | Mode             |
| ------------------------ | ---------------- |
| Users                    | Share or isolate |
| Folders                  | Isolate only     |
| Dashboards               | Isolate only     |
| Data sources             | Isolate only     |
| Alerts                   | Isolate only     |
| Notification channels    | Isolate only     |
| Annotations              | Isolate only     |
| Reports                  | Isolate only     |
| API keys                 | Isolate only     |
| Authentication providers | Share only       |
| Configuration settings   | Share only       |
| Licenses                 | Share            |

The member of one organization cannot view dashboards assigned to another organization. However, a user can belong to multiple organizations.

Grafana Server Administrators are responsible for creating organizations. For more information about the Grafana Server Administrator role, refer to [Grafana server administrators]({{< relref "../roles-and-permissions/#grafana-server-administrators" >}}).

## View a list of organizations

Complete this task when you want to view a list of existing organizations.

### Before you begin

- Ensure that you have Grafana Server Administrator permissions

**To view a list of organizations:**

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, and then **Organizations**.

## Create an organization

Create an organization when you want to isolate dashboards and other resources from each other.

### Before you begin

- Ensure that you have Grafana Server Administrator permissions

**To create an organization:**

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, and then **Organizations**.
1. Click **+ New org**.
1. Enter the name of the new organization and click **Create**.

   Grafana creates the organization, adds you as the organization administrator, and opens the Default preferences page.

1. In the Preferences section, select a home dashboard, time zone, and week start.

   For more information about preferences, refer to [Preferences]({{< relref "../organization-preferences/" >}}).

For more information about adding users to an organization, refer to [Add a user to an organization]({{< relref "../user-management/server-user-management/add-remove-user-to-org/" >}}).

## Delete an organization

This action permanently removes an organization from your Grafana server.

{{% admonition type="warning" %}}
Deleting the organization also deletes all teams and dashboards associated the organization.
{{% /admonition %}}

### Before you begin

- Ensure that you have Grafana Server Administrator permissions
- Because the delete action removes all teams and dashboards associated with the organization, ensure that the users who rely on the organization dashboards are aware of the change

**To delete an organization:**

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, and then **Organizations**.
1. Click the red **X** next to the organization that you want to delete.
1. Click **Delete**.

## Edit an organization

Edit an organization when you want to change its name.

### Before you begin

- Ensure that you have Grafana Server Administrator permissions

**To edit an organization:**

1. Sign in to Grafana as a server administrator.
1. Click **Administration** in the left-side menu, and then **Organizations**.
1. Click the organization you want to edit.
1. Update the organization name and click **Update**.
