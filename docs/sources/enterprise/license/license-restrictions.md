---
aliases:
  - /docs/grafana/latest/enterprise/license-restrictions/
  - /docs/grafana/latest/enterprise/license/license-restrictions/
description: Grafana Enterprise license restrictions
keywords:
  - grafana
  - licensing
  - enterprise
title: License restrictions
weight: 300
---

# Grafana Enterprise license restrictions

When you become a Grafana Enterprise customer, you receive a license that governs your use of Grafana Enterprise.

## Active users limit

Your Grafana license includes a maximum number of active users.

- An _active user_ is a user who has signed in to Grafana within the last 30 days. This is a rolling window that is updated daily.
- When you reach the maximum number of active users, only currently active users (users who have signed in over the past 30 days) can sign in. When a new user or a previously-inactive user tries to sign in, the user will see an error message indicating that Grafana has reached its license limit.
- The user's role, number of dashboards that a user can view or edit, and the number of organizations that they can access does not affect the active user count.
- A license limit banner appears to administrators when Grafana reaches its active user limit; editors and viewers do not see the banner.

### Determine the number of active users

To determine the number of active users:

1. Sign in to Grafana Enterprise as a System Administrator.

1. Click **Server Admin** (the shield icon).

1. Click **Statistics and licensing**.

1. Review the utilization count on the **Utilization** panel.

## Tiered licensing (deprecated)

A tiered license defines dashboard viewers, and dashboard editors and administrators, as two distinct user types that each have their own user limit.

As of Grafana Enterprise version 9.0, Grafana only counts and enforces the _total_ number of active users in your Grafana instance. For example, if you purchase 150 active users, you can have 20 admins, 70 editors, and 60 viewers, or you can have 150 admins. Grafana will enforce the total number of active users even if you use a license that grants a specific number of admins or editors and a certain number of viewers. This is a more permissive policy than before, which gives you the flexibility to change users' roles.

If you are running a pre-9.0 version of Grafana Enterprise, please refer to the documentation for that version to learn more about license enforcement in your current version.

## Additional license restrictions

Your license is controlled by the following rules:

**License expiration date:** The license includes an expiration date, which is the date when a license becomes inactive.

As the license expiration date approaches, you will see a banner in Grafana that encourages you to renew. To learn about how to renew your license and what happens in Grafana when a license expires, refer to [License expiration]({{< relref "license-expiration/" >}}).

**Grafana License URL:** Your license does not work with an instance of Grafana with a different root URL.

The License URL is the complete URL of your Grafana instance, for example `https://grafana.your-company.com/`. It is defined in the [root_url]({{< relref "../../setup-grafana/configure-grafana/#root_url">}}) configuration setting.

**Concurrent sessions limit**: As of Grafana Enterprise 7.5, users can initiate up to three concurrent sessions of Grafana.

The system creates a session when a user signs in to Grafana from a new device, a different browser, or an incognito window. If a user signs in to Grafana from another tab or window within the same browser, only one session is used.

When a user reaches the session limit, the fourth connection succeeds and the longest inactive session is signed out.

## Request usage billing

You can request Grafana Labs to activate usage billing which allows an unlimited number of active users. When usage billing is enabled, Grafana does not enforce active user limits or display warning banners. Instead, you are charged for active users that exceed the limit, according to your customer contract.

Usage billing involves a contractual agreement between you and Grafana Labs, and it is only available if Grafana Enterprise is configured to [automatically refresh its license token]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#auto_refresh_license" >}}).

## Request a change to your license

To increase the number of licensed users within Grafana, extend a license, or change your licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, which you can activate from within Grafana.

For instructions about how to activate your license after it is updated, refer to [Activate an Enterprise license]({{< relref "activate-license/" >}}).
