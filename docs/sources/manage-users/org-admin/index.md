---
title: Org admin tasks
weight: 200
---

# Manage users as an Org Admin

An _organization_ is a group of users on a Grafana server. Each user can belong to more than one organization. Every member of the organization has a _role_ in that organization that grants them a certain level of permissions. For more information, refer to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}).

Organization Admins, also called Org Admins, can manage users in their organization. Some of their tasks overlap with the [Server Admin tasks]({{< relref "../server-admin/_index.md" >}}).

> **Note:** You must have Admin permissions in an organization in order to perform the tasks described in this page.

## View organization user account list

See a complete list of users with accounts in your Grafana organization. If necessary, you can use the search field to filter the list.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Users**.

Grafana displays all user accounts on the server, listed in alphabetical order by user name. The following information is displayed:

- **Login -** The value in the **Username** field of the account.
- **Email -** The email associated with the user account.
- **Name -** The value in the **Name** field of the account.
- **Seen -** How long ago the user logged in. If they have never logged in, then the default longest time (10y) is displayed.
- **Role -** The organization role currently assigned to the user.

![Org Admin user list](/static/img/docs/manage-users/org-user-list-7-3.png)

## Manage organization invitations

Organization Admins can invite users to their Grafana organizations and manage invitations. When an invited user signs in to Grafana, a user account is created for them if one does not already exist.

### Invite user to organization

Invite or add an existing user account to your organization.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Users**.
1. Click **Invite**.
1. Enter the following information:
   - **Email or Username -** Either the email or username that the user will use to sign in to Grafana.
   - **Name -** (Optional) The value in the **Name** field of the account.
   - **Role -** Click the organization role to assign this user. For more information, refer to [Organization roles]({{< relref "../../permissions/organization_roles.md" >}}).
   - **Send invite email**
     - **Yes -** If your organization has SMTP set up, then Grafana sends an email to the user inviting them to log in to Grafana and join your organization.
     - **No -** The user is not sent an invitation, but they can sign in to the Grafana server with the email or username that you entered.
1. Click **Submit**.

![Invite User](/static/img/docs/manage-users/org-invite-user-7-3.png)

### View pending invitations

Review invitations of users that were invited but have not signed in.

![Pending Invites button](/static/img/docs/manage-users/pending-invites-button-7-3.png)

> **Note:** The button is only visible if there are unanswered invitations.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Users**.
1. Click **Pending Invites**.

Grafana displays a list of pending invitations. If necessary, you can use the search field to filter the list.

![Pending Invites list](/static/img/docs/manage-users/pending-invites-list-7-3.png)

### Cancel invitation

Revoke the invitation of a user that was invited but has not logged in.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Users**.
1. Click **Pending Invites**.
1. Click the red **X** next to the invitation that you want to cancel.

## Change organization role

Every user account is assigned an [Organization role]({{< relref "../../permissions/organization_roles.md" >}}). Organization admins can change the role assigned to a user in their organization.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Users**.
1. Find the user account for which you want to change the role. Use the search field to filter the list if necessary.
1. Click the **Role** list in the user account that you want to change. Grafana displays the list of available roles.
1. Click the role that you want to assign.

## Remove user from organization

Remove a user account from your organization. This prevents them from accessing the dashboards and data sources associated with the organization, but it does not remove the user account from the server.

1. Hover your cursor over the **Configuration** (gear) icon in the side menu.
1. Click **Users**.
1. Find the user account that you want to delete. Use the search field to filter the list if necessary.
1. Click the red **X** next to remove the user from your organization.
