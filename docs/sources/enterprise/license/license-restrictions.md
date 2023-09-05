+++
title = "License restrictions"
description = "Grafana Enterprise license restrictions"
keywords = ["grafana", "licensing", "enterprise"]
aliases = ["/docs/grafana/v8.3/enterprise/license-restrictions"]
weight = 300
+++

# License restrictions

Enterprise licenses are limited by the number of active users, the license expiration date, and the URL of the Grafana instance.

## User limits

Users are limited by the number of active users and the number of concurrent sessions for a given account.

### Active users limit

Grafana licenses allow for a certain number of active users per instance. An active user is any user that has signed in to Grafana within the past 30 days.

In the context of licensing, each user is classified as either a viewer or an editor/admin. This classification is the user's **licensed role**, and it can be different from that user's [organization role]({{< relref "../../permissions/organization_roles.md" >}}) in Grafana.

- An editor/admin is a user who has permission to edit and save a dashboard. Examples of editors are as follows:
  - Grafana server administrators.
  - Users who are assigned an organization role of Editor or Admin.
  - Users who have been granted admin or edit permissions at the dashboard or folder level. Refer to [Dashboard and folder permissions]({{< relref "../../permissions/dashboard-folder-permissions.md" >}}). This means that even if a user is assigned to an organization role of Viewer they will be counted as an editor.
- A viewer is a user with the Viewer role, which does not permit the user to save a dashboard.

Additional details:

- When the number of maximum active viewers or editor/admins is reached, only those currently active users can sign in. New users or non-active users cannot sign in.
- A license limit banner will appear to admins when Grafana reaches its active user limit. Editor/admins and viewers will not see the banner.
- To see how many active users you have in each licensed role (Viewer or Editor/Admin), refer to the Licensing page in the Server Admin section of Grafana, which is located at `[your-grafana-url.com]/admin/licensing`. Please note that _licensed_ roles can differ from the Active Viewer/Editor/Admin counts on the /admin/stats page in Grafana. This is because the Stats page only counts a user's assigned organization role and does not account for dashboard and folder permissions.
- Restrictions are applied separately for viewers and editor/admins. If a Grafana instance reaches its limit of active viewers but not its limit of active editor/admins, new editors and admins will still be able to sign in.
- You can change a user's licensed role by updating their permissions in Grafana (their role or their dashboard/folder permissions). Their new role will go into effect the next time that user signs in.
- Active user counts are not affected by the number of dashboards, folders, or organizations a user can edit or admin. An active user who can edit many dashboards or folders in many different orgs is still counted as a single editor.

### Concurrent sessions limit

Sometimes it is useful to sign in to an account from multiple locations simultaneously. As of Grafana Enterprise 7.5+, accounts are limited to the number of concurrent sessions authorized in each license, which is typically three. A new session is created when a user signs in to Grafana from a new device, a different browser, or an incognito window. If a user signs in to Grafana from another tab or window within the same browser, then only one session is used.

Given a limit of three sessions, the longest inactive session is signed out of Grafana when a fourth person signs in to the same account.

### Usage billing

You can request Grafana Labs to turn on usage billing to allow an unlimited number of active users. When usage billing is enabled, Grafana does not enforce active user limits or display warning banners. Instead, you are charged for active users above the limit, according to your customer contract.

Usage billing involves a contractual agreement between you and Grafana Labs, and it is only available if Grafana Enterprise is configured to [automatically refresh its license]({{< relref "../enterprise-configuration.md#auto_refresh_license" >}}).

## Expiration date

The license expiration date is the date when a license is no longer active. As the license expiration date approaches, Grafana Enterprise displays a banner.

## License URL

License URL is the root URL of your Grafana instance. The license will not work on an instance of Grafana with a different root URL.

## Download a dashboard and folder permissions report

This CSV report helps to identify users, teams, and roles that have been granted Admin or Edit permissions at the dashboard or folder level.

To download the report:

1. Hover your cursor over the **Server Admin** (shield) icon in the side menu and then click **Licensing**.
1. At the bottom of the page, click **Download report**.

## Update license restrictions

To increase the number of licensed users within Grafana, extend a license, or change your licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, which you can activate from within Grafana.

For instructions on how to activate your license after it is updated, refer to [Activate an Enterprise license]({{< relref "./activate-license.md" >}}).
