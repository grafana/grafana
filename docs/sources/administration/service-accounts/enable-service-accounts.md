---
description: This topic shows you how to to enable the service accounts feature in
  Grafana
keywords:
  - Feature toggle
  - Service accounts
menuTitle: Enable service accounts
title: Enable service accounts in Grafana
weight: 40
---

# Enable service accounts in Grafana

Service accounts are available behind the `service-accounts` feature toggle available in Grafana 9.0+.

You can enable service accounts by:

- modifying the Grafana configuration file, or
- configuring an environment variable

## Enable service accounts with configuration file

This topic shows you how to enable service accounts by modifying the Grafana configuration file.

1. Sign in to the Grafana server and locate the configuration file. For more information about finding the configuration file, refer to LINK.
1. Open the configuration file and locate the [feature toggles] section. In your [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}), add `serviceAccounts` as a [feature_toggle]({{< relref "../../administration/configuration.md#feature_toggle" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = serviceAccounts
```

1. Save your changes, Grafana should recognize your changes; in case of any issues we recommend restarting the Grafana server.

## Enable service accounts with an environment variable

This topic shows you how to enable service accounts by setting environment variables before starting Grafana.

> **Note:** Environment variables override any configuration file settings.

You can use `GF_FEATURE_TOGGLES_ENABLE = serviceAccounts` environment variable.

For more information regarding on how to setup environment variables refer to [Configuring with environment variables]({{< relref "../../administration/configuration.md#override-configuration-with-environment-variables" >}}).
