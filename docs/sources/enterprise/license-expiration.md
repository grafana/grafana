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

If your license has expired most of Grafana will keep on working with some limited or disabled enterprise functionality and a banner informing all users that the Grafana instance is unlicensed. Your Grafana admin needs to upload a new license file to ensure that all functionality of Grafana Enterprise keeps working properly.

> Replace your license as soon as possible. Running Grafana Enterprise with an expired license is unsupported and can lead to unexpected consequences.

## Replacing your license

1. Identify the location of your current `license.jwt` file. In a standard installation it is stored inside Grafana's data directory, which on a typical Linux installation is in `/var/lib/grafana/data`. This location might be overridden in the ini file [Configuration](https://grafana.com/docs/grafana/latest/installation/configuration/)
```
[enterprise]
license_path = /path/to/your/license.jwt
```
The configuration file's location may also be overridden by the `GF_ENTERPRISE_LICENSE_PATH` environment variable.
2. Log in to your [Grafana.com](https://grafana.com/login) user and make sure you're in the correct organization in the dropdown at the top of the page.
3. Under the **Grafana Enterprise** section in the menu bar to the left, choose licenses and download the currently valid license with which you want to run Grafana. If you cannot see a valid license on Grafana.com, please contact your account manager at Grafana Labs to renew your subscription.
4. Replace the current `license.jwt`-file with the one you've just downloaded.
5. Restart Grafana.

## Data source permissions

Your current data source permissions will keep working as expected, but you'll be unable to add new data source permissions until the license has been renewed.

## Reporting

You won't be able to configure new reports or generate previews.
Scheduled reports will not be generated or sent.

## SAML authentication

SAML is not affected by an expired license.

## Enterprise plugins

Enterprise plugins might stop working.

## White labeling

The white labeling feature is turned off, meaning that any white labeling options will not have any effect.
