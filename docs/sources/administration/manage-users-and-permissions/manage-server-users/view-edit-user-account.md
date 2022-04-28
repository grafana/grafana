+++
title = "View and edit a user account"
aliases = ["docs/grafana/latest/administration/manage-users-and-permissions/manage-server-users/view-user-account-details.md"]
weight = 110
+++

# View user details

View user details when you want to see login, and organizations and permissions settings associated with a user.

## Before you begin:

- Ensure you have Grafana server administrator privileges

**To view user details**:

1. Sign in to Grafana as a server administrator.
1. Hover your cursor over the **Server Admin** (shield) icon until a menu appears, and click **Users**.
1. Click a user.

A user account contains the following sections.

### User information

This section contains basic user information, which users can update.

![Server Admin user information section](/static/img/docs/manage-users/server-admin-user-information-7-3.png)

### Permissions

This indicates whether the user account has the Grafana administrator flag applied. If the flag is set to **Yes**, then the user is a Grafana server administrator.

![Server Admin Permissions section](/static/img/docs/manage-users/server-admin-permissions-7-3.png)

### Organisations

This section lists the organizations the user belongs to and their assigned role.

![Server Admin Organizations section](/static/img/docs/manage-users/server-admin-organisations-7-3.png)

### Sessions

This section includes recent user sessions and information about the time the user logged in and they system they used. You can force logouts, if necessary.

![Server Admin Sessions section](/static/img/docs/manage-users/server-admin-sessions-7-3.png)

# Edit a user account

Edit a user account when you want to modify user login credentials, or delete, disable, or enable a user.

## Before you begin

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
