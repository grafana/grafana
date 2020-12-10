+++
title = "Manage users"
weight = 100
aliases =["/docs/grafana/latest/manage-users/add-or-remove-user/","/docs/grafana/latest/manage-users/enable-or-disable-user/"]
+++

# Manage users as a Server Admin

This topic explains user management tasks performed by Grafana Server Admins.

In order to perform any of these tasks, you must be logged in to Grafana on an account with Grafana Server Admin permissions. For more information about Grafana Admin permissions, refer to [Grafana Server Admin role]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}})

> **Note:** The Grafana Server Admin role does not exist in Grafana Cloud. Grafana Cloud users cannot perform tasks listed in this section.

## View the user account list

See a complete list of users with accounts on your Grafana server.

{{< docs/shared "manage-users/view-server-user-list.md" >}}

Grafana displays all user accounts on the server, listed in alphabetical order by user name. The following information is displayed:
- **Login -** The value in the **Username** field of the account.
- **Email -** The email associated with the user account.
- **Name -** The value in the **Name** field of the account.
- **Seen -** How long ago the user logged in. If they have never logged in, then the default longest time (10y) is displayed.
- **Server Admin status -** If the user account has **Grafana Admin** option set, then a shield icon is displayed.
- **Account status -** If the account is disabled, then the **Disabled** label is displayed.

![Server Admin user list](/img/docs/manage-users/server-user-list-7-3.png)

## View user account details

See all details associated with a specific user account.

{{< docs/list "manage-users/view-server-user-list" >}}
1. Click the user account you wish to view. If necessary, use the search field at the top of the tab to search for the specific user account that you need.

Each user account contains the following sections.

### User information

This section of the account contains basic user information. Users can change values in these fields on their own account.

- **Name**
- **Email**
- **Username**
- **Password**

![Server Admin user information section](/img/docs/manage-users/server-admin-user-information-7-3.png)

### Permissions

This indicates whether the user account has the Grafana Admin flag applied or not. If it is **Yes**, then the user is a Grafana Server Admin.

![Server Admin Permissions section](/img/docs/manage-users/server-admin-permissions-7-3.png)

### Organisations

This section lists the organizations the user account belongs to and the roles they hold within each organization.

![Server Admin Organizations section](/img/docs/manage-users/server-admin-organisations-7-3.png)

### Sessions

See recent sessions that the user was logged on, including when they logged on and information about the system the logged on with. You can force logouts if necessary.

![Server Admin Sessions section](/img/docs/manage-users/server-admin-sessions-7-3.png)

## Add a user account

Create a new user account at the server level.

{{< docs/list "manage-users/view-server-user-list" >}}
1. Click **New user**.
1. Enter the following information:
   - **Name -** Required.
   - **E-mail -** Optional if a **Username** is entered.
   - **Username -** Optional if an **E-mail** is entered.
   - **Password -** Required.
1. Click **Create user**.

The user can change all this information after they log in. For instructions, refer to [Edit your Grafana profile]({{< relref "../../administration/preferences.md#edit-your-grafana-profile" >}}) and [Change your password]({{< relref "../../administration/change-your-password.md" >}}).

## Edit a user account

Change information or settings in an individual user account.

### Edit user information

Edit information on an existing user account, including the user name, email, username, and password.

{{< docs/list "manage-users/view-server-user-list-search" >}}
1. In the User information section, click **Edit** next to the field that you want to change.
1. Enter the new value and then click **Save**.

### Change the password on a user account

Users can change their own passwords, but Server Admins can change user passwords as well.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. In the User information section, click **Edit** next to the **Password** field.
1. Enter the new value and then click **Save**. Grafana requires a value at least four characters long in this field.

### Delete a user account

Permanently remove a user account from the server.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. Click **Delete User**.
1. Click **Delete user** to confirm the action.

### Enable or disable a user account

Temporarily turn on or off account access, but do not remove the account from the server.

#### Disable user account

Prevent a user from logging in with this account, but do not delete the account. You might disable an account if a colleague goes on sabbatical.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. Click **Disable User**.
1. Click **Disable user** to confirm the action.

#### Enable a user account

Reactivate a disabled user account.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. Click **Enable User**.

## Add/remove Grafana Admin flag

Give or remove the Grafana Server Admin role from a user account.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. In the Permissions section, click **Change**.
1. Click **Yes** or **No**, depending on whether or not you want this user account to have the Grafana Server Admin role.
1. Click **Change**.

The next time this user logs in, their permissions will be updated.

## Add a user to an organization

Add a user account to an existing organization. User accounts can belong to multiple organizations, but each user account must belong to at least one organization.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. In the Organisations section, click **Add user to organisation**.
1. In the **Add to an organization** window:
   1. Select the **Organisation** that you are adding the user to.
   1. Select the **Role** that the user should have in the organization.
   1. Click **Add to organisation**.

## Remove a user from an organization

Remove a user account from an organization that it is currently assigned to.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. In the Organisations section, click **Remove from organisation** next to the organization that you want to remove the user from.
1. Click **Confirm removal**.

## Change organization role

Change the organization role assigned to a user account.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. In the Organisations section, click **Change role** next to the organization that you want to change the user role for.
1. Select the new role and then click **Save**.

## View and manage user sessions

See when a user last logged in and information about how they logged in. You can also force the account to log out of Grafana.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. Scroll down to the Sessions section to view sessions associated with this user account.

## Force a user to log out of Grafana

If you suspect a user account is compromised or is no longer authorized to access the Grafana server, then you can force logout the account.

### Force logout of one device

Log the user account out of one specific device that is logged in to Grafana.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. Scroll down to the Sessions section.
1. Click **Force logout** next to the session entry that you want logged out of Grafana.
1. Click **Confirm logout**.

### Force logout of all devices

Log the user account out of all devices that are logged in to Grafana.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
1. Scroll down to the Sessions section.
1. Click **Force logout from all devices**.
1. Click **Force logout**.
