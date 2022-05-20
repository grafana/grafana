+++
aliases = ["/docs/grafana/latest/enterprise/license-restrictions/", "/docs/grafana/latest/enterprise/license/license-restrictions/"]
description = "Grafana Enterprise license restrictions"
keywords = ["grafana", "licensing", "enterprise"]
title = "License restrictions"
weight = 300
+++

# Understanding Grafana Enterprise licensing

When you become a Grafana Enterprise customer, you receive a license that governs your use of Grafana Enterprise.

You either have:

- [combined licensing](#combined-licensing), or
- [tiered licensing](#tiered-licensing-deprecated) (deprecated)

## Combined licensing

As of Grafana Enterprise Version 8.3, you can purchase (or transition to) combined licensing. With combined licensing, you purchase a specific number of users, and you are free to distribute those users across all roles, in any combination.
For example, if you purchase 150 licenses, you can have 20 admins, 70 editors, and 60 viewers, or you can have 10 admins, 100 editors, and 40 viewers. This change reduces license complexity.

### Active users limit

Your Grafana license includes a maximum number of active users.

- An _active user_ is a user who has signed in to Grafana within the last 30 days. This is a rolling window that is updated daily.
- When you reach the number of maximum active users, only currently active users can sign in; new users and non-active users cannot sign in when you reach the limit.
- The number of dashboards that a user can view or edit, and the number of organizations that they can access does not affect the active user count.
- A license limit banner appears to administrators when Grafana reaches its active user limit; editors and viewers do not see the banner.

### Determine the number of active users

To determine the number of active users:

1. Sign in to Grafana Enterprise as a System Administrator.

1. Click **Server Admin** (the shield icon).

1. Click **Statistics and licensing**.

1. Review the utilization count on the **Utilization** panel.

## Tiered licensing (deprecated)

Tiered licensing defines dashboard viewers, and dashboard editors and administrators, as two distinct user types that each have their own user limit.

As of Grafana Enterprise Version 9.0, tiered licensing will be automatically treated as combined licensing.
For example, your license might include 300 viewers and 50 editors or administrators. This will be handled as a combined license for 350 users.

## License restrictions common to both license types

Your license is controlled by the following rules:

**License expiration date:** The license includes an expiration date, which is the date when a license becomes inactive.

As the license expiration date approaches, you will see a banner in Grafana that encourages you to renew. To learn about how to renew your license and what happens in Grafana when a license expires, refer to [License expiration]({{< relref "./license-expiration.md" >}}).

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
