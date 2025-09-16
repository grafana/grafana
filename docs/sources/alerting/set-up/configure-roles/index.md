---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-roles/
description: Configure roles and permissions for Grafana Alerting
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - roles and permissions
labels:
  products:
    - oss
title: Configure roles and permissions
weight: 150
---

# Configure roles and permissions

A user is any individual who can log in to Grafana. Each user is associated with a role that includes permissions. Permissions determine the tasks a user can perform in the system. For example, the Admin role includes permissions for an administrator to create and delete users.

For more information, refer to [Organization roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#organization-roles).

## Manage access using roles

For Grafana OSS, there are three roles: Admin, Editor, and Viewer.

Details of the roles and the access they provide for Grafana Alerting are below.

| Role   | Access                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin  | Write access to alert rules, notification resources (notification API, contact points, templates, time intervals, notification policies, and silences), and provisioning. |
| Editor | Write access to alert rules, notification resources (notification API, contact points, templates, time intervals, notification policies, and silences), and provisioning. |
| Viewer | Read access to alert rules, notification resources (notification API, contact points, templates, time intervals, notification policies, and silences).                    |

## Assign roles

To assign roles, admins need to complete the following steps.

1. Navigate to **Administration** > **Users and access** > **Users, Teams, or Service Accounts**.
1. Search for the user, team or service account you want to add a role for.
1. Add the role you want to assign.

## Manage access using folder permissions

You can extend the access provided by a role to alert rules and rule-specific silences by assigning permissions to individual folders.

This allows different users, teams, or service accounts to have customized access to modify or silence alert rules in specific folders.

Refer to the following table for details on the additional access provided by folder permissions:

| Folder permission | Additional Access                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| View              | No additional access: all permissions already contained in Viewer role.                                 |
| Edit              | Write access to alert rules and their rule-specific silences _only_ in the given folder and subfolders. |
| Admin             | Same additional access as Edit.                                                                         |

{{< admonition type="note" >}}
You can't use folders to customize access to notification resources.
{{< /admonition >}}

To manage folder permissions, complete the following steps.

1. In the left-side menu, click **Dashboards**.
1. Hover your mouse cursor over a folder and click **Go to folder**.
1. Click **Manage permissions** from the Folder actions menu.
1. Update or add permissions as required.

## Manage access using contact point permissions

### Before you begin

Extend or limit the access provided by a role to contact points by assigning permissions to individual contact point.

This allows different users, teams, or service accounts to have customized access to read or modify specific contact points.

Refer to the following table for details on the additional access provided by contact point permissions.

| Folder permission | Additional Access                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| View              | View and export contact point as well as select it on the Alert rule edit page                                                                |
| Edit              | Update or delete the contact point                                                                                                            |
| Admin             | Same additional access as Edit and manage permissions for the contact point. User should have additional permissions to read users and teams. |

### Steps

To contact point permissions, complete the following steps.

1. In the left-side menu, click **Contact points**.
1. Hover your mouse cursor over a contact point and click **More**.
1. Click **Manage permissions** from the actions menu.
1. Update or add permissions as required.
