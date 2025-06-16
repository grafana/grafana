---
aliases:
  - ../change-your-password/
  - ../manage-user-preferences/
description: Learn how to update your user preferences and switch organizations
keywords:
  - password
  - change
  - organization
  - change
labels:
  products:
    - enterprise
    - oss
title: Manage user preferences
weight: 400
---

# Manage user preferences

Grafana allows you to manage certain aspects of your user account, including your user name, email, and password.

You can also view important information about your account, such as the organizations and roles to which you are assigned and the Grafana sessions associated with your account.

## Change your Grafana password

You can change your Grafana password at any time.

{{% admonition type="note" %}}
If your Grafana instance uses an external authentication provider, then you might not be able to change your password in Grafana. Contact your Grafana administrator for more information.
{{% /admonition %}}

**To change your password**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Change Password**.
1. Enter your old password and a new password.
1. Confirm your new password.
1. Click **Change Password**.

## Edit your profile

Your profile includes your name, user name, and email address, which you can update.

**To edit your profile**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Profile**.
1. In the **Profile** section, update your details and click **Save**.

## Edit your preferences

You can choose the way you would like data to appear in Grafana, including the user interface theme, home dashboard, timezone, and first day of the week. You can set these preferences for your own account, for a team, for an organization, or Grafana-wide using configuration settings. Your user preferences take precedence over team, organization, and Grafana default preferences. For more information, see [Grafana preferences](../../organization-preferences/).

- **Interface theme** determines whether Grafana appears in light mode or dark mode. You can also choose from several experimental modes. By default, the interface theme is set to dark mode. You can also [quickly view and change themes](#view-and-change-themes) using the **Change theme** option.
- **Home dashboard** refers to the dashboard you see when you sign in to Grafana. By default, this is set to the Home dashboard.
- **Timezone** is used by dashboards when you set time ranges, so that you view data in your timezone instead of UTC.
- **Week start** is the first day of the week you want to use in dashboard time ranges, for example, `This week`.
- **Language** determines the language used for parts of the Grafana interface.

**To edit your preferences**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Profile**.
1. Update any of the values in the Preferences section.
1. Click **Save** at the bottom of the section.

### View and change themes

{{< admonition type="note" >}}
The **Change theme** drawer is an experimental feature. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. Enable the `grafanaconThemes` feature toggle in Grafana to use this feature. This feature is automatically enabled in Grafana Cloud.
{{< /admonition >}}

The **Change theme** drawer allows you to see the color scheme of a theme without having to select it first.
It also lets you quickly change a color scheme from anywhere in Grafana without first going to your profile.

To access the **Change theme** drawer, click the user icon in the top-right corner of the page and select **Change theme**.

{{< figure src="/media/docs/grafana/screenshot-themes-drawer-v11.6.png" max-width="650px" alt="The Change theme drawer opened" >}}

## Switch organizations

When you sign in to Grafana, the system signs you in to a default organization. If you are assigned to multiple organizations, then you might need to switch organizations. For example, if you need to view a dashboard not associated with your current organization, then you should switch organizations to view associated dashboards.

**To switch organizations**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Switch organization**.
1. Next to the organization that you want to sign in to, click **Switch to**.

## View your assigned organizations

Every user is a member of at least one organization. You can have different roles in each organization of which you are a member.

**To view your assigned organizations**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Profile**.
1. Scroll down to the Organizations section and review the following information:
   - **Name**: The name of the organizations of which you are a member.
   - **Role**: The role to which you are assigned in the organization. For more information about roles and permissions, refer to [Organization users and permissions](../../roles-and-permissions/#organization-users-and-permissions).
   - **Current**: Grafana indicates the organization that you are currently signed into as _Current_. If you are a member of multiple organizations, you can click **Select** to switch to that organization.

## View your Grafana sessions

Grafana logs your sessions in each Grafana instance. You can review this section if you suspect someone has misused your Grafana credentials.

**To view your Grafana sessions**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Profile**.
1. Scroll down to the **Sessions** section.

## Sign out a user session

You can sign out other sessions using your account in order to prevent other people from accessing Grafana using your credentials.

**To sign out one of your Grafana sessions**:

1. Sign in to Grafana.
1. Click the user icon in the top right corner of the page and select **Profile**.
1. Scroll down to the **Sessions** section.
1. Click the red "sign out" icon next to the session you would like to sign out.
