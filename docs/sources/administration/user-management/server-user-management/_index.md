---
aliases:
  - ../../manage-users/server-admin/
  - ../../manage-users/server-admin/server-admin-manage-users/
  - ../manage-users-and-permissions/manage-server-users/
  - ../manage-users-and-permissions/manage-server-users/add-user/
  - ../manage-users-and-permissions/manage-server-users/force-user-logout/
  - ../manage-users-and-permissions/manage-server-users/view-edit-user-account/
  - ../manage-users-and-permissions/manage-server-users/view-list-users/
  - ../manage-users-and-permissions/manage-server-users/view-user-account-details/
title: Server user management
weight: 100
---

# Server user management

A _user_ is defined as any individual who can log in to Grafana. Each user is associated with a _role_ that includes _permissions_. Permissions determine the tasks a user can perform in the system.

If you have [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions in Grafana, you can manage all users for a Grafana instance in the Server Admin section:

{{< section >}}

If you have [organization administrator]({{< relref "../../roles-and-permissions/#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, refer to [Manage users in a organization]({{< relref "../manage-org-users/" >}}).

For more information about user roles and permissions, refer to [Roles and permissions]({{< relref "../../roles-and-permissions/" >}}). For more information about managing users in general, see [User management]({{< relref "../" >}}).

## View a list of users

You can see a list of users with accounts on your Grafana server. This action might be useful when you want to know which role you assigned to each user.

### Before you begin

- Ensure you have Grafana server administrator privileges

**To view a list of users**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.

> **Note:** If you have [organization administrator]({{< relref "../../roles-and-permissions/#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, you can still [view of list of users in a given organization]({{< relref "../manage-org-users/#view-a-list-of-organization-users" >}}).

## View user details

View user details when you want to see login, and organizations and permissions settings associated with a user.

### Before you begin:

- Ensure you have Grafana server administrator privileges

**To view user details**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.

A user account contains the following sections.

#### User information

This section contains basic user information, which users can update.

#### Permissions

This indicates whether the user account has the Grafana administrator flag applied. If the flag is set to **Yes**, then the user is a Grafana server administrator.

#### Organizations

This section lists the organizations the user belongs to and their assigned role.

#### Sessions

This section includes recent user sessions and information about the time the user logged in and they system they used. You can force logouts, if necessary.

## Edit a user account

Edit a user account when you want to modify user login credentials, or delete, disable, or enable a user.

### Before you begin

- Ensure you have Grafana server administrator privileges

**To edit a user account**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. Complete any of the following actions, as necessary.

| Action                          | Description                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update name, email, or username | **Is the user notified of these changes?**. Click **Save** after you make a change.                                                                             |
| Change the user's password      | The new password must be at least four characters long. Click **Save** after you make a change.                                                                 |
| Delete a user                   | This action permanently removes the user from the Grafana server. The user can no longer sign in after you make this change.                                    |
| Disable user account            | This action prevents a user from signing in with this account, but does not delete the account. You might disable an account if a colleague goes on sabbatical. |
| Enable a user account           | This action enables a user account.                                                                                                                             |

## Add a user

Add users when you want to manually provide individuals with access to Grafana.

When you create a user using this method, you must create their password. The user does not receive a notification by email. To invite a user to Grafana and allow them to create their own password, [invite a user to join an organization]({{< relref "../manage-org-users#invite-a-user-to-join-an-organization" >}}).

When you configure advanced authentication using Oauth, SAML, LDAP, or the Auth proxy, users are created automatically.

### Before you begin

- Ensure that you have Grafana server administrator privileges

**To add a user**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click **New user**.
1. Complete the fields and click **Create user**.

When you create a user, the system assigns the user viewer permissions in a default organization, which you can change. You can now [add a user to a second organization]({{< relref "add-remove-user-to-org/" >}}).

> **Note:** If you have [organization administrator]({{< relref "../../roles-and-permissions/#organization-roles" >}}) permissions and _not_ [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, you can still add users by [inviting a user to join an organization]({{< relref "../manage-org-users#invite-a-user-to-join-an-organization" >}}).

## Force a user to log out of Grafana

If you suspect a user account is compromised or is no longer authorized to access the Grafana server, then you can force the user to log out of Grafana.

The force logout action can apply to one device that is logged in to Grafana, or all devices logged in to Grafana.

### Before you begin

- Ensure you have Grafana server administrator privileges

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.
1. Scroll down to the **Sessions** section.
1. Perform one of the following actions:
   - Click **Force logout** next to the session entry that you want logged out of Grafana.
   - Click **Force logout from all devices**.
1. Confirm the logout.
