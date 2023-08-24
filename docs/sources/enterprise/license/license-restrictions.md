---
aliases:
- ../license-restrictions/
description: Grafana Enterprise license restrictions
keywords:
- grafana
- licensing
- enterprise
title: License restrictions
weight: 300
---

# License restrictions

Enterprise licenses are limited by the number of active users, the license expiration date, and the URL of the Grafana instance.

## User limits

Users are limited by the number of active users and the number of concurrent sessions for a given account.

### Active users limit

Grafana licenses allow for a certain number of active users per instance. An active user is any user that has signed in to Grafana within the past 30 days.

In the context of licensing, each user is classified as either a viewer or an editor:

- An editor is a user who has permission to edit and save a dashboard. Examples of editors are as follows:
    - Grafana server administrators.
    - Users who are assigned an organizational role of Editor or Admin.
    - Users that have been granted Admin or Edit permissions at the dashboard or folder level. Refer to [Dashboard and folder permissions]({{< relref "../../permissions/dashboard-folder-permissions.md" >}}).
- A viewer is a user with the Viewer role, which does not permit the user to save a dashboard.

Restrictions are applied separately for viewers and editors.

When the number of maximum active viewers or editors is reached, only they can sign in. New users or non-active users cannot sign in.

### Concurrent sessions limit

Sometimes it is useful to sign in to an account from multiple locations simultaneously. As of Grafana Enterprise 7.5+, accounts are limited to the number of concurrent sessions authorized in each license, which is typically three. A new session is created when a user signs in to Grafana from a new device, a different browser, or an incognito window. If a user signs in to Grafana from another tab or window within the same browser, then only one session is used.

Given a limit of three sessions, the longest inactive session is signed out of when a fourth person signs in to the same account.

### Usage billing

You can request Grafana Labs to turn on usage billing to allow an unlimited number of active users. When usage billing is enabled, Grafana does not enforce active user limits. Instead, we charge for active users above the limit, according to your customer contract.

Usage billing must be agreed upon with Grafana Labs, and it is only available if Grafana Enterprise is configured to [automatically refresh its license]({{< relref "../enterprise-configuration.md#auto_refresh_license" >}}).

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
