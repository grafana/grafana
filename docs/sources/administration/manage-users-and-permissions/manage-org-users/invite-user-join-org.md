+++
aliases = ["/docs/grafana/latest/administration/manage-users-and-permissions/manage-org-users/invite-user-join-org/"]
title = "Invite a user to join an organization"
weight = 10
+++

# Invite a user to join an organization

When you invite users to join an organization, you assign the **Admin**, **Editor**, or **Viewer** role which controls user access to the dashboards and data sources owned by the organization. Users receive an email that prompts them to accept the invitation.

- If you know that the user already has access Grafana and you know their user name, then you issue an invitation by entering their user name.
- If the user is new to Grafana, then use their email address to issue an invitation. The system automatically creates the user account on first sign in.

> **Note:** If you have [server administrator]({{< relref "../about-users-and-permissions.md#grafana-server-administrators" >}}) permissions, you can also manually [add a user to an organization]({{< relref "../../manage-users-and-permissions/manage-server-users/add-remove-user-to-org.md" >}}).

## Before you begin

- Ensure you have organization administrator privileges.
- If the user already has access to Grafana, obtain their user name.
- Determine the permissions you want to assign to the user. For more information about organization permissions, refer to [Organization roles]({{< relref "../about-users-and-permissions/#organization-roles" >}}).

**To invite or add an existing user account to your organization**:

1. Sign in to Grafana as an organization administrator.
1. To switch to the organization to which you want to invite a user, hover your mouse over your profile and click **Switch organization** and select an organization.

   > **Note**: It might be that you are currently in the proper organization and don't need to switch organizations.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu and click **Users**.
1. Click **Invite**.
1. Enter the following information:

   | Field             | Description                                                                                                                                                                                                                                                              |
   | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Email or username | Either the email or username that the user will use to sign in to Grafana.                                                                                                                                                                                               |
   | Name              | The user's name.                                                                                                                                                                                                                                                         |
   | Role              | Click the organization role to assign this user. For more information about organization roles, refer to [Organization roles]({{< relref "../about-users-and-permissions#organization-roles" >}})..                                                                      |
   | Send invite email | Switch to on if your organization has configured. The system sends an email to the user inviting them to sign in to Grafana and join the organization. Switch to off if you are not using email. The user can sign in to Grafana with the email or username you entered. |

1. Click **Submit**.

If the invitee is not already a user, the system adds them.

![Invite User](/static/img/docs/manage-users/org-invite-user-7-3.png).
