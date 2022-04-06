---
title: 'Enable service accounts in Grafana'
menuTitle: 'Enable service accounts'
description: 'This contains information to enable service accounts feature in Grafana'
aliases: [docs/sources/administration/service-accounts/enable-service-accounts.md]
weight: 40
keywords:
  - Feature toggle
  - Service accounts
---

# Enable service accounts in Grafana

Service accounts are available behind the `service-accounts` feature toggle available in Grafana 9.0+.
You can enable service accounts by:
- modifying the Grafana configuration file, or
- configuring an environment variable

## Enable service accounts with configuration file

In your [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}), add `service-accounts` as a [feature_toggle]({{< relref "../../administration/configuration.md#feature_toggle" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = service-accounts
```

## Enable service accounts with an environment variable

You can use `GF_FEATURE_TOGGLES_ENABLE = service-accounts` environment variable to override the configuration file.

For more information regarding environment variables refer to [Configuring with environment variables]({{< relref "../../administration/configuration.md#configure-with-environment-variables" >}}).
