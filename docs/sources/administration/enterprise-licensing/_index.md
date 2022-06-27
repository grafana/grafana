---
aliases:
  - /docs/grafana/latest/enterprise/license/
  - /docs/grafana/latest/enterprise/activate-license/
  - /docs/grafana/latest/enterprise/license/activate-license/
  - /docs/grafana/latest/enterprise/license-expiration/
  - /docs/grafana/latest/enterprise/license/license-expiration/
  - /docs/grafana/latest/enterprise/license-restrictions/
  - /docs/grafana/latest/enterprise/license/license-restrictions/
description: Activate and manage a Grafana Enterprise license
keywords:
  - grafana
  - licensing
  - enterprise
title: Enterprise licensing
weight: 500
---

# Grafana Enterprise license

When you become a Grafana Enterprise customer, you gain access to Grafana's premium observability features, including enterprise data source plugins, reporting, and role-based access control. In order to use these [enhanced features of Grafana Enterprise]({{< relref "../../enterprise/" >}}), you must purchase and activate a Grafana Enterprise license.

To purchase a license directly from Grafana Labs, [Contact a Grafana Labs representative](https://grafana.com/contact?about=grafana-enterprise). To activate an Enterprise license purchased from Grafana Labs, refer to [Activate an Enterprise license]({{< ref "#activate-an-enterprise-license" >}}).

You can also purchase a Grafana Enterprise license through the AWS Marketplace. To learn more about activating a license purchased through AWS, refer to [Activate a Grafana Enterprise license purchased through AWS Marketplace]({{< relref "./activate-aws-marketplace-license/" >}}).

{{< section >}}

## Activate an Enterprise license

Follow these steps to activate your Grafana Enterprise license:

### Step 1. Download your license file

To download your Grafana Enterprise license:

1. Sign in to your [Grafana Cloud](https://grafana.com) account.
1. Go to **My Account** and select an organization from the drop-down menu at the top left of the page. On the Overview page for each organization, you can see a section for Grafana Enterprise licenses. Click **Details** next to a license.
1. At the bottom of the license details page, select **Download token** to download the `license.jwt` file that contains your license.

### Step 2. Add your license to a Grafana instance

There is more than one way to add the license to a Grafana instance:

#### Upload the license file via the Grafana server administrator page

This is the preferred option for single instance installations of Grafana Enterprise.

1. Sign in as a Grafana server administrator.
1. Navigate to **Server Admin > Upgrade** within Grafana.
1. Click **Upload license token file**.
1. Select your license file, and upload it.

#### Put the `license.jwt` file into the data directory of Grafana

On Linux systems, the data directory is usually at `/var/lib/grafana`.

You can also configure a custom location for the license file using the grafana.ini setting:

```bash
[enterprise]
license_path = /company/secrets/license.jwt
```

This setting can also be set with an environment variable, which is useful if you're running Grafana with Docker and have a custom volume where you have placed the license file. In this case, set the environment variable `GF_ENTERPRISE_LICENSE_PATH` to point to the location of your license file.

#### Set the content of the license file as a configuration option

You can add a license by pasting the content of the `license.jwt`
to the grafana.ini configuration file:

```bash
[enterprise]
license_text = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aGlzIjoiaXMiLCJub3QiOiJhIiwidmFsaWQiOiJsaWNlbnNlIn0.bxDzxIoJlYMwiEYKYT_l2s42z0Y30tY-6KKoyz9RuLE
```

This option can be set using the `GF_ENTERPRISE_LICENSE_TEXT`
environment variable.

### Step 3. Ensure that the license file's root URL matches the root_url configuration option

Update the [`root_url`]({{< relref "../../setup-grafana/configure-grafana/#root-url" >}}) in your configuration. It should be the URL that users type in their browsers to access the frontend, not the node hostname(s).

This is important, because as part of the validation checks at startup, Grafana compares the license URL to the [`root_url`]({{< relref "../../setup-grafana/configure-grafana/#root-url" >}}) in your configuration.

In your configuration file:

```
[server]
root_url = https://grafana.example.com/
```

Or with an environment variable:

```
GF_SERVER_ROOT_URL=https://grafana.example.com/
```

### Step 4. Restart Grafana

To finalize the installation of Grafana Enterprise, restart Grafana to enable all Grafana Enterprise features. Refer to [restart Grafana]({{< relref "../../setup-grafana/restart-grafana/" >}}) for more information.

## License expiration

If your license has expired, most of Grafana keeps working as normal. Some enterprise functionality stops or runs with reduced functionality and Grafana displays a banner informing the users that Grafana is running on an expired license. Your Grafana admin needs to upload a new license file to restore full functionality.

> Replace your license as soon as possible. Running Grafana Enterprise with an expired license is unsupported and can lead to unexpected consequences.

### Update your license

1. Locate your current `license.jwt` file. In a standard installation it is stored inside the Grafana data directory, which on a typical Linux installation is in `/var/lib/grafana/data`. This location might be overridden in the ini file [Configuration]({{< relref "../../setup-grafana/configure-grafana/" >}}).

   ```ini
   [enterprise]
   license_path = /path/to/your/license.jwt
   ```

   The configuration file's location may also be overridden by the `GF_ENTERPRISE_LICENSE_PATH` environment variable.

2. Log in to your [Grafana Cloud Account](https://grafana.com/login) and make sure you're in the correct organization in the dropdown at the top of the page.
3. Under the **Grafana Enterprise** section in the menu bar to the left, choose licenses and download the currently valid license with which you want to run Grafana. If you cannot see a valid license on Grafana.com, please contact your account manager at Grafana Labs to renew your subscription.
4. Replace the current `license.jwt`-file with the one you've just downloaded.
5. [Restart Grafana]({{< relref "../../setup-grafana/restart-grafana/" >}}).

### If your license expires

If your Grafana Enterprise license expires, you can expect the following changes in feature behavior.

#### Data source permissions

Your current data source permissions will keep working as expected, but you'll be unable to add new data source permissions until the license has been renewed.

#### LDAP authentication

- LDAP synchronization is not affected by an expired license.
- Team sync debugging is unavailable.

#### SAML authentication

SAML authentication is not affected by an expired license.

#### Role-based access control (RBAC)

- Creating, updating and deleting custom roles is not available.
- Modifying permissions for custom roles is not available.

#### Reporting

- You're unable to configure new reports or generate previews.
- Existing reports continue to be sent.

#### Enterprise plugins

Enterprise plugins might stop working.

#### White labeling

The white labeling feature is turned off, meaning that any white labeling options will not have any effect.

#### Usage insights

Exporting usage insights logs to Loki will be turned off for licenses expired for more than 7 days.

All the other usage insights features are turned off as soon as the license expires, meaning that you will not be able to see dashboard usage, presence indicators, or use improved search. Grafana continues to collect usage data and you will have access to it as soon as you update your license.

#### Vault integration

Vault integration is not affected by an expired license.

#### Auditing

Auditing is not affected by an expired license.

#### License restrictions

The concurrent session limit remains active for seven days after the expiration date, after which it will be turned off.

The active users limit is turned off immediately.

#### Settings updates at runtime

Settings updates at runtime are not affected by an expired license.

## Grafana Enterprise license restrictions

When you become a Grafana Enterprise customer, you receive a license that governs your use of Grafana Enterprise.

### Active users limit

Your Grafana license includes a maximum number of active users.

- An _active user_ is a user who has signed in to Grafana within the last 30 days. This is a rolling window that is updated daily.
- When you reach the maximum number of active users, only currently active users (users who have signed in over the past 30 days) can sign in. When a new user or a previously-inactive user tries to sign in, the user will see an error message indicating that Grafana has reached its license limit.
- The user's role, number of dashboards that a user can view or edit, and the number of organizations that they can access does not affect the active user count.
- A license limit banner appears to administrators when Grafana reaches its active user limit; editors and viewers do not see the banner.

#### Determine the number of active users

To determine the number of active users:

1. Sign in to Grafana Enterprise as a System Administrator.

1. Click **Server Admin** (the shield icon).

1. Click **Statistics and licensing**.

1. Review the utilization count on the **Utilization** panel.

### Tiered licensing (deprecated)

A tiered license defines dashboard viewers, and dashboard editors and administrators, as two distinct user types that each have their own user limit.

As of Grafana Enterprise version 9.0, Grafana only counts and enforces the _total_ number of active users in your Grafana instance. For example, if you purchase 150 active users, you can have 20 admins, 70 editors, and 60 viewers, or you can have 150 admins. Grafana will enforce the total number of active users even if you use a license that grants a specific number of admins or editors and a certain number of viewers. This is a more permissive policy than before, which gives you the flexibility to change users' roles.

If you are running a pre-9.0 version of Grafana Enterprise, please refer to the documentation for that version to learn more about license enforcement in your current version.

### Additional license restrictions

Your license is controlled by the following rules:

**License expiration date:** The license includes an expiration date, which is the date when a license becomes inactive.

As the license expiration date approaches, you will see a banner in Grafana that encourages you to renew. To learn about how to renew your license and what happens in Grafana when a license expires, refer to [License expiration]({{< ref "#license-expiration" >}}).

**Grafana License URL:** Your license does not work with an instance of Grafana with a different root URL.

The License URL is the complete URL of your Grafana instance, for example `https://grafana.your-company.com/`. It is defined in the [root_url]({{< relref "../../setup-grafana/configure-grafana/#root_url" >}}) configuration setting.

**Concurrent sessions limit**: As of Grafana Enterprise 7.5, users can initiate up to three concurrent sessions of Grafana.

The system creates a session when a user signs in to Grafana from a new device, a different browser, or an incognito window. If a user signs in to Grafana from another tab or window within the same browser, only one session is used.

When a user reaches the session limit, the fourth connection succeeds and the longest inactive session is signed out.

### Request usage billing

You can request Grafana Labs to activate usage billing which allows an unlimited number of active users. When usage billing is enabled, Grafana does not enforce active user limits or display warning banners. Instead, you are charged for active users that exceed the limit, according to your customer contract.

Usage billing involves a contractual agreement between you and Grafana Labs, and it is only available if Grafana Enterprise is configured to [automatically refresh its license token]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#auto_refresh_license" >}}).

### Request a change to your license

To increase the number of licensed users within Grafana, extend a license, or change your licensed URL, contact [Grafana support](https://grafana.com/profile/org#support) or your Grafana Labs account team. They will update your license, which you can activate from within Grafana.

For instructions about how to activate your license after it is updated, refer to [Activate an Enterprise license]({{< ref "#activate-an-enterprise-license" >}}).
