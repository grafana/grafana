---
description: Learn how to send a support bundle to Grafana Labs support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - support
  - bundles
title: Send a support bundle to Grafana Labs support
menutitle: Send a support bundle to support
weight: 200
---

# Send a support bundle to Grafana Labs support

When you encounter problems with your Grafana instance, you can send us a support bundle that contains information about your Grafana instance, including:

- Grafana version
- Installed plugins
- Grafana configuration
- Deployed database information and migrations

## Available support bundle components

A support bundle can include any of the following components:

- **Usage statistics**: Usage statistic for the Grafana instance
- **User information**: A list of users of the Grafana instance
- **Database and Migration information**: Database information and migration log
- **Plugin information**: Plugin information for the Grafana instance
- **Basic information**: Basic information about the Grafana instance (version, memory usage, and so on)
- **Settings**: Settings for the Grafana instance
- **SAML**: Healthcheck connection and metadata for SAML (only displayed if SAML is enabled)
- **LDAP**: Healthcheck connection and metadata for LDAP (only displayed if LDAP is enabled)

## Steps

To generate a support bundle and send the support bundle to Grafana Labs via a support ticket:

1. Click the Help icon.

1. Click **Support Bundles**.

   ![Support bundle panel](/static/img/docs/troubleshooting/support-bundle.png)

1. Click **New Support Bundle**.

1. Select the components that you want to include in the support bundle.

1. Click **Create**.

1. After the support bundle is ready, click **Download**.

   Grafana downloads the support bundle to an archive (tar.gz) file.

1. Attach the archive (tar.gz) file to a support ticket that you send to Grafana Labs Technical Support.
