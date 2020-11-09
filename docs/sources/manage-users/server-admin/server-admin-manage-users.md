+++
title = "Server Admin - Manage users"
type = "docs"
weight = 100
+++

# Manage users as a Server Admin

This topic explains user management tasks performed by Grafana Server Admins.

In order to perform any of these tasks, you must be logged in to Grafana on an account with Grafana Server Admin permissions. For more information about Grafana Admin permissions, refer to [Grafana Server Admin role]({{< relref "../../permissions/_index.md#grafana-server-admin-role" >}})

> **Note:** The Grafana Server Admin role does not exist in Grafana Cloud. Grafana Cloud users cannot perform tasks listed in this section.

## View the user account list

See a complete list of users with accounts on your Grafana server.

{{< docs/shared "view-server-user-list" >}}

Grafana displays all user accounts on the server, listed in alphabetical order by user name. The following information is displayed:
- **Login -** The value in the **Username** field of the account.
- **Email -** The email associated with the user account.
- **Name -** The value in the **Name** field of the account.
- **Seen -** How long ago the user logged in. If they have never logged in, then the default longest time (10y) is displayed.
- **Server Admin status -** If the user account has **Grafana Admin** option set, then a shield icon is displayed.
- **Account status -** If the account is disabled, then the **Disabled** label is displayed.

{{< docs-imagebox img="/img/docs/manage-users/server-user-list-7-3.png" max-width="1200px">}}

## View user account details

See all details associated with a specific user account.

{{< docs/shared "view-server-user-list" >}}
1. Click the user account you wish to view. If necessary, use the search field at the top of the tab to search for the specific user account that you need.

Each user account contains the following sections.

### User information

This section of the account contains basic user information. Users can change values in these fields on their own account.

- **Name**
- **Email**
- **Username**
- **Password**

{{< docs-imagebox img="/img/docs/manage-users/server-admin-user-information-7-3.png" max-width="1200px">}}

### Permissions

This indicates whether the user account has the Grafana Admin flag applied or not.

{{< docs-imagebox img="/img/docs/manage-users/server-admin-permissions-7-3.png" max-width="1200px">}}

### Organisations

This section lists the organizations the user account belongs to and the roles they hold within each organization.

{{< docs-imagebox img="/img/docs/manage-users/server-admin-organisations-7-3.png" max-width="1200px">}}

### Sessions

See recent sessions that the user was logged on, including when they logged on and information about the system the logged on with. You can force logouts from 

{{< docs-imagebox img="/img/docs/manage-users/server-admin-sessions-7-3.png" max-width="1200px">}}

## Add a user account

Create a new user account at the server level.

1. [View the user account list](#view-the-user-account-list).
1. Click **New user**.
1. Enter the following information:
   - **Name -** Required.
   - **E-mail -** Optional if a **Username** is entered.
   - **Username -** Optional if an **E-mail** is entered.
   - **Password -** Required.
1. Click **Create user**.

The user can change all this information after they log in. For instructions, refer to [Change your information](NEED LINK) and [Change your password](NEED Link).

## Edit a user account 

### Edit user information

Edit information on an existing user account, including the user name, email, username, and password.

1. [View the user account list](#view-the-user-account-list).
1. Click the user account that you want to edit. If necessary, use the search field to find the account.
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

## Add a user to an organization

## Remove a user from an organization

## Change organization role

## View user sessions

## Force user logout

Force logout from one or all devices, available in the sessions