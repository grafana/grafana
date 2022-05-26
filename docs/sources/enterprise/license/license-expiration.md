+++
aliases = ["/docs/grafana/latest/enterprise/license-expiration/", "/docs/grafana/latest/enterprise/license/license-expiration/"]
description = ""
keywords = ["grafana", "licensing"]
title = "License expiration"
weight = 200
+++

# License expiration

If your license has expired, most of Grafana keeps working as normal. Some enterprise functionality stops or runs with reduced functionality and Grafana displays a banner informing the users that Grafana is running on an expired license. Your Grafana admin needs to upload a new license file to restore full functionality.

> Replace your license as soon as possible. Running Grafana Enterprise with an expired license is unsupported and can lead to unexpected consequences.

## Update your license

1. Locate your current `license.jwt` file. In a standard installation it is stored inside the Grafana data directory, which on a typical Linux installation is in `/var/lib/grafana/data`. This location might be overridden in the ini file [Configuration]({{< relref "../../administration/configuration.md" >}}).

   ```ini
   [enterprise]
   license_path = /path/to/your/license.jwt
   ```

   The configuration file's location may also be overridden by the `GF_ENTERPRISE_LICENSE_PATH` environment variable.

2. Log in to your [Grafana Cloud Account](https://grafana.com/login) and make sure you're in the correct organization in the dropdown at the top of the page.
3. Under the **Grafana Enterprise** section in the menu bar to the left, choose licenses and download the currently valid license with which you want to run Grafana. If you cannot see a valid license on Grafana.com, please contact your account manager at Grafana Labs to renew your subscription.
4. Replace the current `license.jwt`-file with the one you've just downloaded.
5. [Restart Grafana]({{< relref "../../installation/restart-grafana.md" >}}).

## If your license expires

If your Grafana Enterprise license expires, you can expect the following changes in feature behavior.

### Data source permissions

Your current data source permissions will keep working as expected, but you'll be unable to add new data source permissions until the license has been renewed.

### LDAP authentication

- LDAP synchronization is not affected by an expired license.
- Team sync debugging is unavailable.

### SAML authentication

SAML authentication is not affected by an expired license.

### Role-based access control (RBAC)

- Creating, updating and deleting custom roles is not available.
- Modifying permissions for custom roles is not available.

### Reporting

- You're unable to configure new reports or generate previews.
- Existing reports continue to be sent.

### Enterprise plugins

Enterprise plugins might stop working.

### White labeling

The white labeling feature is turned off, meaning that any white labeling options will not have any effect.

### Usage insights

Exporting usage insights logs to Loki will be turned off for licenses expired for more than 7 days.

All the other usage insights features are turned off as soon as the license expires, meaning that you will not be able to see dashboard usage, presence indicators, or use improved search. Grafana continues to collect usage data and you will have access to it as soon as you update your license.

### Vault integration

Vault integration is not affected by an expired license.

### Auditing

Auditing is not affected by an expired license.

### License restrictions

The concurrent session limit remains active for seven days after the expiration date, after which it will be turned off.

The active users limit is turned off immediately.

### Settings updates at runtime

Settings updates at runtime are not affected by an expired license.
