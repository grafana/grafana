---
aliases:
  - ../../manage-users/org-admin/
  - ../manage-users-and-permissions/manage-org-users/
  - ../manage-users-and-permissions/manage-org-users/change-user-org-permissions/
  - ../manage-users-and-permissions/manage-org-users/invite-user-join-org/
  - ../manage-users-and-permissions/manage-org-users/manage-pending-invites/
  - ../manage-users-and-permissions/manage-org-users/remove-user-from-org/
  - ../manage-users-and-permissions/manage-org-users/view-list-org-users/
title: Manage users in an organization
weight: 400
---

# Manage users in an organization

Organization administrators can invite users to join their organization. Organization users have access to organization resources based on their role, which is **Admin**, **Editor**, or **Viewer**. Permissions associated with each role determine the tasks a user can perform in the system.

For more information about organization user permissions, refer to [Organization users and permissions]({{< relref "../../roles-and-permissions/#organization-users-and-permissions" >}}).

{{< section >}}

## View a list of organization users

You can see a list of users with accounts in your Grafana organization. If necessary, you can use the search field to filter the list.

### Before you begin

- Ensure you have organization administrator privileges

**To view a list of organization users**:

1. Sign in to Grafana as an organization administrator.
1. Navigate to **Administration > Users**.

> **Note:** If you have [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, you can also [view a global list of users]({{< relref "../server-user-management#view-a-list-of-users" >}}) in the Server Admin section of Grafana.

## Change a user's organization permissions

Update user permissions when you want to enhance or restrict a user's access to organization resources. For more information about organization permissions, refer to [Organization roles]({{< relref "../../roles-and-permissions/#organization-roles" >}}).

> **Note:** Organization roles sync from the authentication provider on user sign-in. To prevent synchronization of organization roles from the authentication provider regardless of their role in the authentication provider, then refer to the `skip_org_role_sync` setting in your Grafana configuration. Refer to [skip org role sync]({{< relref "../../../setup-grafana/configure-grafana/#authgrafana_com-skip_org_role_sync" >}}) for more information.

### Before you begin

- Ensure you have organization administrator privileges

**To change the organization role of a user**:

1. Sign in to Grafana as an organization administrator.
1. Navigate to **Administration > Users**.
1. Find the user account for which you want to change the role.

   If necessary, use the search field to filter the list.

1. Locate the user on the list and in the **Role** column, click the user role.
1. Select the role that you want to assign.
1. Click **Update**.

> **Note:** If you have [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, you can also [change a user's organization permissions]({{< relref "../server-user-management/change-user-org-permissions/" >}}) in the Server Admin section.

## Invite a user to join an organization

When you invite users to join an organization, you assign the **Admin**, **Editor**, or **Viewer** role which controls user access to the dashboards and data sources owned by the organization. Users receive an email that prompts them to accept the invitation.

- If you know that the user already has access Grafana and you know their user name, then you issue an invitation by entering their user name.
- If the user is new to Grafana, then use their email address to issue an invitation. The system automatically creates the user account on first sign in.

> **Note:** If you have [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, you can also manually [add a user to an organization]({{< relref "../server-user-management/add-remove-user-to-org/" >}}).

### Before you begin

- Ensure you have organization administrator privileges.
- If the user already has access to Grafana, obtain their user name.
- Determine the permissions you want to assign to the user. For more information about organization permissions, refer to [Organization roles]({{< relref "../../roles-and-permissions/#organization-roles" >}}).

**To invite or add an existing user account to your organization**:

1. Sign in to Grafana as an organization administrator.
1. To switch to the organization to which you want to invite a user, hover your mouse over your profile and click **Switch organization** and select an organization.

   > **Note**: It might be that you are currently in the proper organization and don't need to switch organizations.

1. Navigate to **Administration > Users**.
1. Click **Invite**.
1. Enter the following information:

   | Field             | Description                                                                                                                                                                                                                                                              |
   | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Email or username | Either the email or username that the user will use to sign in to Grafana.                                                                                                                                                                                               |
   | Name              | The user's name.                                                                                                                                                                                                                                                         |
   | Role              | Click the organization role to assign this user. For more information about organization roles, refer to [Organization roles]({{< relref "../../roles-and-permissions/#organization-roles" >}})..                                                                        |
   | Send invite email | Switch to on if your organization has configured. The system sends an email to the user inviting them to sign in to Grafana and join the organization. Switch to off if you are not using email. The user can sign in to Grafana with the email or username you entered. |

1. Click **Submit**.

If the invitee is not already a user, the system adds them.

## Manage a pending invitation

Periodically review invitations you have sent so that you can see a list of users that have not yet accepted the invitation or cancel a pending invitation.

> **Note:** The **Pending Invites** button is only visible if there are unanswered invitations.

### Before you begin

- Ensure you have organization administrator privileges

**To manage a pending invitation**:

1. Sign in to Grafana as an organization administrator.
1. Navigate to **Administration > Users**.
1. Click **Pending Invites**.

   The **Pending Invites** button appears only when there are unaccepted invitations.

To cancel an invitation, click the red **X** next to the invitation.

To copy an invitation link and send it directly to a user, click Copy Invite. You can then paste the invite link into a message.

## Remove a user from an organization

You can remove a user from an organization when they no longer require access to the dashboard or data sources owned by the organization. No longer requiring access to an organization might occur when the user has left your company or has internally moved to another organization.

This action does not remove the user account from the Grafana server.

### Before you begin

- Ensure you have organization administrator privileges

**To remove a user from an organization**:

1. Sign in to Grafana as an organization administrator.
1. Navigate to **Administration > Users**.
1. Find the user account that you want to remove from the organization.

   Use the search field to filter the list, if necessary.

1. Click the red **X** to remove the user from the organization.

> **Note:** If you have [server administrator]({{< relref "../../roles-and-permissions/#grafana-server-administrators" >}}) permissions, you can also [remove a user from an organization]({{< relref "../server-user-management/add-remove-user-to-org/#remove-a-user-from-an-organization" >}}) on the Users page of the Server Admin section.
