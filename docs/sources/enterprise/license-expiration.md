+++
title = "License Expiration"
description = ""
keywords = ["grafana", "licensing"]
type = "docs"
[menu.docs]
parent = "enterprise"
weight = 8
+++

# License expiration

If your license has expired most of Grafana keeps working as normal. Some enterprise functionality stops or runs with reduced functionality and Grafana displays a banner informing the users that Grafana is running on an expired license. Your Grafana admin needs to upload a new license file to restore full functionality.

> Replace your license as soon as possible. Running Grafana Enterprise with an expired license is unsupported and can lead to unexpected consequences.

## Update your license

1. Locate your current `license.jwt` file. In a standard installation it is stored inside Grafana's data directory, which on a typical Linux installation is in `/var/lib/grafana/data`. This location might be overridden in the ini file [Configuration](https://grafana.com/docs/grafana/latest/administration/configuration/).
    ```ini
    [enterprise]
    license_path = /path/to/your/license.jwt
    ```
    The configuration file's location may also be overridden by the `GF_ENTERPRISE_LICENSE_PATH` environment variable.

2. Log in to your [Grafana Cloud Account](https://grafana.com/login) and make sure you're in the correct organization in the dropdown at the top of the page.
3. Under the **Grafana Enterprise** section in the menu bar to the left, choose licenses and download the currently valid license with which you want to run Grafana. If you cannot see a valid license on Grafana.com, please contact your account manager at Grafana Labs to renew your subscription.
4. Replace the current `license.jwt`-file with the one you've just downloaded.
5. Restart Grafana.

## If your license expires

If your Grafana Enterprise license expires, the following functionality affected as follows.

### Data source permissions

Your current data source permissions will keep working as expected, but you'll be unable to add new data source permissions until the license has been renewed.

### LDAP authentication

* LDAP synchronization is not affected by an expired license.
* Enhanced LDAP debugging is unavailable.

### SAML authentication

SAML authentication is not affected by an expired license.

### Reporting

* You're unable to configure new reports or generate previews.
* Scheduled reports are not generated or sent.

### Enterprise plugins

Enterprise plugins might stop working.

### White labeling

The white labeling feature is turned off, meaning that any white labeling options will not have any effect.

### Usage insights

All the usage insights features are turned off, meaning that you won't be able to look at dashboard usage, presence indicator or to use improved search. Grafana still collects usage data and you will have access to it as soon as you update your license.

### Vault integration

Vault integration is not affected by an expired license.
