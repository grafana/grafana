+++
title = "Manage user preferences"
weight = 400
description = "Learn how to update your user preferences and switch organizations"
keywords = ["password", "change", "organization", "change"]
aliases = ["/docs/grafana/latest/administration/change-your-password/", "docs/sources/manage-user-preferences/_index.md"]
+++

# Manage user preferences

Grafana allows you to manage certain aspects of your user account, including your user name, email, and password.

You can also view important information about your account, such as the organizations and roles to which you are assigned and the Grafana sessions associated with your account.

## Switch organizations

When you sign in to Grafana, the system signs you in to a default organization. If you are assigned to multiple organizations, then you might need to switch organizations. For example, if you need to view a dashboard not associated with your current organization, then you should switch organizations to view associated dashboards.

**To switch organizations**:

1. Sign in to Grafana.
1. Hover your cursor over the user icon in the lower-left corner of the page and click **Switch organization**.
1. Next to the organization that you want to sign in to, click **Switch to**.

## Change your Grafana password

You can change your Grafana password at any time.

> **Note**: If your Grafana instance uses an external authentication provider, then you might not be able to change your password in Grafana. Contact your Grafana administrator for more information.

**To change your password**:

1. Sign in to Grafana.
1. Hover your mouse over the user icon in the lower-left corner of the page.
1. Click **Change Password**.

   Grafana opens the **Change Password** tab.

1. Enter your old password and a new password.
1. Confirm your new password.
1. Click **Change Password**.

## Edit your profile

Your profile includes your name, user name, and email address, which you can update.

**To edit your profile**:

1. Sign in to Grafana.
1. Hover your cursor over the user icon in the lower-left corner of the page and click **Preferences**.
1. In the **Edit Profile** section, update your profile and click **Save**.

## View your assigned organizations

Every user is a member of at least one organization. You can have different roles in each organization of which you are a member.

**To view your assigned organizations**:

1. Sign in to Grafana.
1. Hover your cursor over the user icon in the lower-left corner of the page and click **Preferences**.
1. Scroll down to the **Organizations** section and review the following information:
   - **Name**: The name of the organizations of which you are a member.
   - **Role**: The role to which you are assigned in the organization. For more information about roles and permissions, refer to [Organization users and permissions]({{< relref "../administration/manage-users-and-permissions/about-users-and-permissions.md#organization-users-and-permissions" >}}).
   - **Current**: Grafana indicates the organization that you are currently signed into as _Current_. If you are a member of multiple organizations, you can click **Select** to switch to that organization.

## View your Grafana sessions

Grafana logs your sessions in each Grafana instance. You can review this section if you suspect someone has misused your Grafana credentials.

**To view your Grafana sessions**:

1. Sign in to Grafana.
1. Hover your cursor over the user icon in the lower-left corner of the page, and click **Preferences**.
1. Scroll down to the **Sessions** section.
