+++
title = "Edit a user account"
aliases = ["path here"]
weight = 70
+++

# Edit a user account

Edit a user account when you want to modify user login credentials, or delete, disable, or enable a user.

<!--- Are users notified when these changes happen? -->

## Before you begin

- Ensure you have Grafana server administrator privileges

**To edit a user account**:

1. Sign in to Grafana as a server administrator.

{{< docs/list >}}
{{< docs/shared "manage-users/view-server-user-list.md" >}}

1. Click a user.
1. Complete any of the following actions, as necessary.

| Action                          | Description                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update name, email, or username | **Is the user notified of these changes?**. Click **Save** after you make a change.                                                                             |
| Change the user's password      | The new password must be at least four characters long. Click **Save** after you make a change.                                                                 |
| Delete a user                   | This action permanently removes the user from the Grafana server. The user can no longer sign in after you make this change.                                    |
| Disable user account            | This action prevents a user from signing in with this account, but does not delete the account. You might disable an account if a colleague goes on sabbatical. |
| Enable a user account           | This action enables a user account.                                                                                                                             |

{{< /docs/list >}}
