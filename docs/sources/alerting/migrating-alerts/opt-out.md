---
aliases:
  - ../opt-in/
  - ../unified-alerting/opt-in/
description: Opt out of Grafana Alerting
title: Opt out of Grafana Alerting
weight: 102
---

# Opt out of Grafana Alerting

You can opt out of Grafana Alerting at any time and switch to using legacy alerting. Alternatively, you can opt out of using alerting in its entirety.

## Staying on legacy alerting

When upgrading to Grafana > 9.0, existing installations that use legacy alerting are automatically upgraded to Grafana Alerting unless you have opted-out of Grafana Alerting before migration takes place. During the upgrade, legacy alerts are migrated to the new alerts type and no alerts or alerting data are lost. To keep using legacy alerting and disable Grafana Alerting:

1. Go to your custom configuration file ($WORKING_DIR/conf/custom.ini).
2. Enter the following in your configuration:

```
[alerting]
enabled = true

[unified_alerting]
enabled = false
```

Installations that have been migrated to Grafana Alerting can [roll back]({{< relref "roll-back/" >}}) to legacy alerting at any time.

> **Note:** This topic is only relevant for OSS and Enterprise customers. Contact customer support to enable or disable Grafana Alerting for your Grafana Cloud stack.

The `ngalert` toggle previously used to enable or disable Grafana Alerting is no longer available.

## Disable alerting

You can disable both Grafana Alerting and legacy alerting in Grafana.

1. Go to your custom configuration file ($WORKING_DIR/conf/custom.ini).
2. Enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = false
```

3. Restart Grafana for the configuration changes to take effect.

If you want to turn alerting back on, you can remove both flags to enable Grafana Alerting.
