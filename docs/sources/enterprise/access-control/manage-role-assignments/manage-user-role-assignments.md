---
description: Manage user role assignments
keywords:
  - grafana
  - fine-grained-access-control
  - roles
  - permissions
  - fine-grained-access-control-usage
  - enterprise
title: Manage user role assignments
weight: 200
---

# Manage user role assignments

There are two ways to assign roles directly to users: in the UI using the role picker, and using the API.

## Manage users' roles within a specific Organization using the role picker

In order to assign roles to a user within a specific Organization using the role picker, you must have a user account with one of the following:

- The Admin built-in role.
- The Server Admin role.
- The fixed role `fixed:permissions:writer`, [assigned for the given Organization]({{< relref "../roles/#scope-of-assignments" >}}).
- A custom role with `users.roles:add` and `users.roles:remove` permissions.

You must also have the permissions granted by the roles that you want to assign or revoke.

Steps:

1. Navigate to the Users Configuration page by hovering over **Configuration** (the gear icon) in the left navigation menu and selecting **Users**.
1. Click on the **Role** column in the row for the user whose role you would like to edit.
1. Deselect one or more selected roles that you would like to remove from that user.
1. Select one or more roles that you would like to assign to that user.
1. Click the **Apply** button to apply the selected roles to that user.

![User role picker in Organization](/static/img/docs/enterprise/user_role_picker_global.png)

The user's permissions will update immediately, and the UI will reflect their new permissions the next time they reload their browser or visit a new page.

**Note**: The roles that you select will be assigned only within the given Organization. For example, if you grant the user the "Data source editor" role while you are in the main Organization, then that user will be able to edit data source in the main Organization but not in others.

## Manage users' roles in multiple Organizations using the role picker

In order to assign roles across multiple Organizations to a user using the role picker, you must have a user account with one of the following:

- The Server Admin built-in role
- The fixed role `fixed:permissions:writer`, [assigned globally]({{< relref "../roles/#scope-of-assignments" >}}).
- A custom role with `users.roles:add` and `users.roles:remove` permissions, [assigned globally]({{< relref "../roles/#scope-of-assignments" >}}).

You must also have the permissions granted by the roles that you want to assign or revoke within the Organization in which you're making changes.

Steps:

1. Navigate to the Users Admin page by hovering over **Server Admin** (the shield icon) in the left navigation menu and selecting **Users**.
1. Click on a user row to edit that user's roles.
1. Under the **Organizations** header, you will see a list of roles assigned to that user within each of their Organizations. Click on the roles in an organization to open the role picker.
1. Deselect one or more selected roles that you would like to remove from that user.
1. Select one or more roles that you would like to assign to that user.
1. Click the **Apply** button to apply the selected roles to that user.

![User role picker in Organization](/static/img/docs/enterprise/user_role_picker_in_org.png)

The user's permissions will update immediately, and the UI will reflect their new permissions the next time they reload their browser or visit a new page.

**Note**: The roles that you select will be assigned only within one Organization. For example, if you grant the user the "Data source editor" role in the row for the main Organization, then that user will be able to edit data source in the main Organization but not in others.

## Manage users' roles via API

To manage user role assignment via API, refer to the [fine-grained access control HTTP API docs]({{< relref "../../../http_api/access_control.md#create-and-remove-user-role-assignments" >}}).
