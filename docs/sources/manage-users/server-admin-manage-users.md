+++
title = "Server Admin - Manage users"
type = "docs"
weight = 100
+++

# Manage users as a Server Admin

This topic explains user management tasks performed by Grafana Server Admins.

In order to perform any of these tasks, you must be logged in to Grafana on an account with Grafana Server Admin permissions. For more information about Grafana Admin permissions, refer to [Grafana Server Admin role]({{< relref "../permissions/_index.md#grafana-server-admin-role" >}})

> **Note:** The Grafana Server Admin role does not exist in Grafana Cloud. Grafana Cloud users cannot perform tasks listed in this section.

## View the user account list XXX

See a complete list of users with accounts on your Grafana server.

{{< docs/shared "view-user-list.md" >}}

Grafana displays all user accounts on the server, listed in alphabetical order by user name. The following information is displayed:
- **Login -** The value in the **Username** field of the account.
- **Email -** The email associated with the user account.
- **Name -** The value in the **Name** field of the account.
- **Seen -** How long ago the user logged in.
- **Server Admin status -** If the user account has **Grafana Admin** option set, then a shield icon is displayed.

## View user account details

See all details associated with a specific user account.

{{< docs/shared "manage-users/view-user-list" >}}
1. Click the user account you wish to view. If necessary, use the search field at the top of the tab to search for the specific user account that you need.

Each user account contains the following sections.

### User information - DFP NOTE - Add images!

This section of the account contains basic user information. Users can change values in these fields on their own account.

Name
Email
Username
Password

### Permissions

This indicates whether the user account has the Grafana Admin flag applied or not.

### Organisations

List of organizations

### Sessions

List of sessions

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

## Delete a user account

## Disable a user account

## Edit user information

## Change the password on a user account

## Add/remove Grafana Admin flag

## Add a user to an organization

## Remove a user from an organization

## Change organization role

## View user sessions
