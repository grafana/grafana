---
title: 'Enable service accounts in Grafana'
menuTitle: 'Enable service accounts'
description: 'This topic shows you how to to enable the service accounts feature in Grafana'
weight: 40
keywords:
  - Feature toggle
  - Service accounts
---

# Enable service accounts in Grafana

Service accounts are available behind the `serviceAccounts` feature toggle, available in Grafana 8.5+.

You can enable service accounts by:

- modifying the Grafana configuration file, or
- configuring an environment variable

## Enable service accounts in the Grafana configuration file

This topic shows you how to enable service accounts by modifying the Grafana configuration file.

1. Sign in to the Grafana server and locate the configuration file. For more information about finding the configuration file, refer to LINK.
2. Open the configuration file and locate the [feature toggles section]({{< relref "../../administration/configuration.md#feature_toggles" >}}). Add `serviceAccounts` as a [feature_toggle]({{< relref "../../administration/configuration.md#feature_toggle" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = serviceAccounts
```

1. Save your changes, Grafana should recognize your changes; in case of any issues we recommend restarting the Grafana server.

## Enable service accounts with an environment variable

This topic shows you how to enable service accounts by setting environment variables before starting Grafana.

Follow the instructions to [override configuration with environment variables]({{< relref "../../administration/configuration.md#override-configuration-with-environment-variables" >}}). Set the following environment variable: `GF_FEATURE_TOGGLES_ENABLE = serviceAccounts`.

> **Note:** Environment variables override configuration file settings.
