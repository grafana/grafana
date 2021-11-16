+++
title = "License restrictions"
description = "Grafana Enterprise license restrictions"
keywords = ["grafana", "licensing", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/license-restrictions"]
weight = 300
+++

# Understanding Grafana Enterprise licensing

When you become a Grafana Enterprise customer, you receive a license that governs your use of Grafana Enterprise.

You either have:

- tiered licensing, or
- combined licensing

To understand which license type you have, refer to [Determine the number of active users for each licensed role](determine-the-number-of-active-users-for-each-licensed role).

## Tiered licensing

Tiered licensing defines dashboard viewers, and dashboard editors and administrators, as two distinct user types that each have their own user limit.

For example, your license might include 300 Viewers and 50 Editors/Admins. Although editors and administrators have separate permissions and can do different things, Grafana counts them as a single **licensed role**.

### Active users limit

Your Grafana license includes a maximum number of Viewer and Editor/Admin active users. For example, your license can include a maximum of 500 Viewers and 100 Editor/Admins.

- An _active user_ is a user who has signed in to Grafana within the last 30 days. This is a rolling window that is updated daily.
- When you reach the number of maximum active Viewers or Editor/Admins, only currently active users can sign in; new users and non-active users cannot sign in when you reach the limit.
- Grafana applies sign-in restrictions separately for Viewers and Editor/Admins. If your Grafana license reaches its limit of active Viewers but not its limit of active Editor/Admins, new Editors and Admins can still sign in.
- The number of dashboards that a user can view or edit, and the number of organizations that they can access does not affect the active user count. A user with editor permissions for many dashboards across many different organizations counts as one editor.
- A license limit banner appears to Admins when Grafana reaches its active user limit. Editors and Viewers do not see the banner.
  Refer to [Optimize your tiered license](#optimize-your-tiered-license) for how to change user roles to make better use of your licenses.

### Permission domains

You can assign role permissions _globally_ and restrict access to a specific dashboard (or set of dashboards).

**Organization permissions**: When you create a user, you select a role on the user details page. Your selection applies to all Grafana dashboards within the Organization. For example, a user with the Viewer role can see all dashboards, but cannot create or edit dashboards. For more information about user roles and permissions, refer to [Organization roles](https://grafana.com/docs/grafana/latest/permissions/organization_roles/).

**Dashboard permissions**: You can also assign permissions to dashboards or groups (folders) of dashboards. For example, you might want a Viewer to also have Editor permissions for a specific dashboard. While that user can see _all_ dashboards, they can only update one of them. For more information about dashboard permissions, refer to [Dashboard and Folder Permissions](https://grafana.com/docs/grafana/latest/permissions/dashboard-folder-permissions/).

When you grant Editor/Admin dashboard permissions to a Viewer, the Editor/Admin active user count increases by one as shown on the **Utilization** panel of the **Stats & licensing** page and the user’s licensed role changes to Editor/Admin.

> The Editor/Admin count increases because the user can edit and save a dashboard.

### Grant dashboard edit without save permissions

You can grant Viewers the ability to edit but not save a dashboard. This setting is useful when you have users that want to explore dashboards, but only need the generated view temporarily and do not require an Editor/Admin license.

> This setting does not affect Viewers’ license role billing.

To grant dashboard edit without save permissions:

1. Open the `grafana.ini` file that contains default configurations.

   The name and location of the file depends on your installation. For information about locating
   the default configurations file, refer to [Configuration](https://grafana.com/docs/grafana/latest/administration/configuration/).

1. Change the `viewers-can-edit` setting to `true`.
1. Restart Grafana Enterprise.

### Determine the number of active users for each licensed role

Because you can assign a user global permissions while also enhancing (or limiting) their access to specific dashboards, it might be helpful for you to periodically check license counts.

To determine the number of active users for each licensed role:

1. Sign in to Grafana Enterprise as a System Administrator.

1. Click **Server Admin** (the shield icon).

1. Click **Statistics and licensing**.

1. Review the role utilization count on the **Utilization** panel.

> Utilization data updates when the user signs back in to Grafana after you change their permissions.

### Optimize your tiered license

Grafana counts Viewer users separately from Editor/Admin users. If you reach the limit imposed by your license for either of these user types, use the following techniques to make optimum use of the licenses you purchased.

**Review and update organization permissions.**

You can modify organization permissions to reduce the count of one type of user. For example, if you reach the limit of Editor/Admin users, assign Viewer permissions to one (or more) Editor/Admin users who agree to read-only access to dashboards. The license count updates when a user signs back in to Grafana.

**Review and update dashboard permissions.**

Because Viewers can also count toward Editor/Admin usage, if they are granted access to edit specific dashboards, review your dashboard permissions and adjust accordingly. Remove Editor or Admin permissions where necessary.

**Delete users.**

Review the number of users you have for each type of permission and remove inactive users. Removing users immediately frees up space for new users.

> When you delete a user you also delete their preferences, dashboard and folder permissions, and references to that user from the dashboard versions they have updated.

Users who are synced via SAML, Oauth, or LDAP will also lose these attributes.

### Update user permissions for dashboards

You can change the access a user has to specific dashboards. For billing purposes, Grafana charges for the highest level permission assigned to the user. For example, if you assign Editor/Admin dashboard permissions to a Viewer user, Grafana counts that user as an Editor/Admin.

To change user permissions for dashboards:

1. Sign in to Grafana as a system administrator.

1. Hover your mouse over **Server Admin** (the shield icon) and click **Statistics and licensing**.

1. In the **Dashboard and Folder Permissions** area, click the dashboard in the \*\*Resource title (URL) column.

   The **Permission** page opens.

1. Use the dropdown list to select a role.

The next time the user signs in, the **Utilization** panel on the **Stats & licensing** page displays updated data.

## Combined licensing

As of Grafana Enterprise Version 8.3, you can purchase (or transition to) combined licensing. With combined licensing, you purchase a specific number of users, and you are free to distribute those users across all roles, in any combination.
For example, if you purchase 150 licenses, you can have 20 Admins, 70 Editors, and 60 Viewers, or you can have 10 Admins, 100 Editors, and 40 Viewers. This change reduces license complexity.

### Transition to combined license model

To transition from the tiered licensing model to the combined license model, contact your Grafana account team and request to switch to combined user pricing. Once you update your contract with the account team, they will issue you a new license token.
For instructions about how to update your license, refer to [Activate license](https://grafana.com/docs/grafana/latest/enterprise/license/activate-license/).

After you apply the token, Grafana Enterprise resets your license and updates the user counts on the **Utilization** panel .

> If you are running Grafana Enterprise 8.2 or earlier, the license grants you the total number of licensed users _for each user type_.

For example, if your current license includes 60 Viewers and 40 Editor/Admins, the new license includes 100 Viewers and 100 Editor/Admins. Grafana Enterprise 8.3 removes the distinction between Viewers and Editor/Admins as shown on the **Utilization** panel.

Before you upgrade to Grafana 8.3, ensure that the total number of active users in Grafana does not exceed the number of users in your combined license. If it does, then new users cannot sign in to Grafana 8.3 until the active user count returns below the licensed limit.

## Determining your current license type

You can identify your license type in Grafana 8.3 and higher. If you are running Grafana 8.2 or older, refer to your contract to determine your license type.

To determine if you have tiered pricing or combined pricing, complete the following steps in Grafana v8.3 or higher:

1. Sign in to Grafana as a system administrator.

1. Hover your mouse over **Server Admin** (the shield icon), and click **Stats & licensing**.

1. In the **Utilization** panel, review the license count data.

   - If you see **Admins & Editors** and **Viewers**, then you have a tiered license.
   - If you only see **Users**, then you have a combined license.

## License restrictions common to both license types

Your license is controlled by the following rules:

**License expiration date:** The license includes an expiration date, which is the date when a license becomes inactive.

  As the license expiration date approaches, you will see a banner in Grafana that encourages you to renew. To learn about how to renew your license and what happens in Grafana when a license expires, refer to [License expiration](https://grafana.com/docs/grafana/latest/enterprise/license/license-expiration/).

**Grafana License URL:** Your license does not work with an instance of Grafana with a different root URL.

  The License URL is the root URL of your Grafana instance.

**Concurrent sessions limit**: As of Grafana Enterprise 7.5, users can initiate up to three concurrent sessions of Grafana.

  The system creates a session when a user signs in to Grafana from a new device, a different browser, or an incognito window. If a user signs in to Grafana from another tab or window within the same browser, only one session is used.

  When a user reaches the session limit, the fourth connection succeeds and the longest inactive session is signed out.

## Request usage billing

You can request Grafana Labs to activate usage billing which allows an unlimited number of active users. When usage billing is enabled, Grafana does not enforce active user limits or display warning banners. Instead, you are charged for active users that exceed the limit, according to your customer contract.

Usage billing involves a contractual agreement between you and Grafana Labs, and it is only available if Grafana Enterprise is configured to [automatically refresh its license token]({{< relref "../enterprise-configuration.md#auto_refresh_license" >}}).

## Request a change to your license

To increase the number of licensed users within Grafana, extend a license, or change your licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, which you can activate from within Grafana.

For instructions about how to activate your license after it is updated, refer to [Activate an Enterprise license]({{< relref "./activate-license.md" >}}).
