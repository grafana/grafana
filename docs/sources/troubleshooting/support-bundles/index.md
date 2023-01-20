---
description: Learn how to send a support bundle to Grafana Labs support for troubleshooting
keywords:
  - grafana
  - troubleshooting
  - support
  - bundles
title: Send a support bundle to Grafana Labs support
menutitle: Send a support bundle to support
weight: 100
---

# Send a support bundle to Grafana Labs support

When you encounter problems with your Grafana instance, you can send us a support bundle. This bundle contains information about your Grafana instance, such as:

- Grafana version
- Installed plugins
- Grafana configuration
- Deployed database information and migrations

To generate a support bundle and send the support bundle to Grafana Labs via a support ticket:

a. Click the Help icon.

b. Click Support Bundles.

![Support bundle panel](/static/img/docs/troubleshooting/support-bundle.png)

c. Click New Support Bundle.

d. Select the components that you want to include in the support bundle.

e. Click Create.

f. Click Download once the support bundle is ready.

Grafana downloads the support bundle to an Archive (tar.gz) file.

b. Attach the archive (tar.gz) file to a support ticket that you send to Grafana Labs Technical Support.

## Available support bundle components

- **Usage statistics**: Usage statistic for grafana instance
- **User information**: A list of users of the grafana instance
- **Database and Migration information**: Database information and migration log
- **Plugin information**: Plugin information for grafana instance
- **Basic information**: Basic information about the grafana instance (Version, mem use information, goroutines…)
- **Settings**: Settings for grafana instance
- **SAML**: Healthcheck connection and metadata for SAML (only displayed if SAML is enabled)
