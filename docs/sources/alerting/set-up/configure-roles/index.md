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

You can further customize access for alert rules by assigning permissions to individual folders.

This prevents every user from having access to modify all alert rules and gives them access to the folders with the alert rules they're working on.

Details on the adding folder permissions as well as roles and the access that provides for Grafana Alerting is below.

| Role   | Folder permission | Access                                                                                                                                                                                        |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin  | -                 | Write access to alert rules in all folders.                                                                                                                                                   |
| Editor | -                 | Write access to alert rules in all folders.                                                                                                                                                   |
| Viewer | Admin             | Read access to alert rules in all folders. Write access to alert rules including silences and mute timings for those alert rules **only** in the folders where the Admin permission is added. |
| Viewer | Editor            | Read access to alert rules in all folders. Write access to alert rules **only** in the folders where the Editor permission is added.                                                          |
| Viewer | Viewer            | Read access to alert rules in all folders.                                                                                                                                                    |

{{< admonition type="note" >}}
You can't use folders to customize access to notification resources.
{{< /admonition >}}

To manage folder permissions, complete the following steps.

1. In the left-side menu, click **Dashboards**.
1. Hover your mouse cursor over a folder and click **Go to folder**.
1. Click **Manage permissions** from the Folder actions menu.
1. Update or add permissions as required.
