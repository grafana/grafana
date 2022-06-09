---
aliases:
  - /docs/grafana/latest/alerting/migrating-alerts/opt-out/
  - /docs/grafana/latest/alerting/opt-in/
  - /docs/grafana/latest/alerting/unified-alerting/opt-in/
description: Opt out of Grafana Alerting
title: Opt out of Grafana Alerting
weight: 102
---

# Opt out of Grafana Alerting

If you have an existing installation, you can opt out of alerting in its entirety or opt out of Grafana Alerting in favor of using legacy alerting.

Existing installations that do not use legacy alerting will have Grafana Alerting enabled by default unless alerting is disabled in the configuration. To keep alerting disabled:

1. Go to your custom configuration file ($WORKING_DIR/conf/custom.ini).
1. Enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = false
```

3. Restart Grafana for the configuration changes to take effect.

If at any time you want to turn alerting back on, you can do so.

Existing installations that use legacy alerting will automatically be upgraded to Grafana Alerting unless you have opted-out of Grafana Alerting before migration takes place. During the upgrade, legacy alerts are migrated to the new alerts type and no alerts or alerting data are lost. To keep using legacy alerting and disable Grafana Alerting:

1. Go to your custom configuration file ($WORKING_DIR/conf/custom.ini).
2. Enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = true
```

> **Note:** This topic is only relevant for OSS and Enterprise customers. Contact customer support to enable or disable Grafana Alerting for your Grafana Cloud stack.

The `ngalert` toggle previously used to enable or disable Grafana Alerting is no longer available.
