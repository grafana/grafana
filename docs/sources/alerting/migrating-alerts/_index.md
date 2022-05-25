+++
aliases = ["/docs/grafana/latest/alerting/migrating-alerts/"]
description = "Enable Grafana alerts"
title = "Migrating to Grafana alerting"
weight = 113
+++

# Migrating to Grafana alerting

Grafana alerting is the default for new Cloud, Enterprise, and OSS installations. The new installations will only show the Grafana alerting icon in the left navigation panel.

- **OSS:** Existing OSS installations with legacy dashboard alerting has both the old (marked as legacy) and the new alerting icons in the navigation panel. You can manage your legacy alerts from the icon marked as legacy. Or you can [opt-in]({{< relref "./opt-in.md" >}}) Grafana alerting and migrate your legacy alerts to the new alerting system.
- **Enterprise** Existing Enterprise instances using legacy alerting has both the old (marked as legacy) and the new alerting icons in the navigation panel. You can [opt-in]({{< relref "./opt-in.MD" >}}) Grafana alerting. You can manage your legacy alerts from the icon marked as legacy. Or you can [opt-in]({{< relref "./opt-in.md" >}}) Grafana alerting and migrate your legacy alerts to the new alerting system.
- **Cloud** Existing Cloud instances with legacy Cloud alerting has both the older Grafana alerting plugin and the new Grafana alerting icons in the navigation panel. Contact customer support to migrate to Grafana alerting for your Cloud stack. Once migration is complete, the legacy alerts can be managed from the new alerting Grafana alerting icon in the navigation panel. The (older) Cloud alerting plugin is uninstalled from your cloud instance.

During migration from legacy alerting to unified alerting, the legacy alerts are updated to the new alerts type, as a result, the user does not lose alerts or alerting data. However, if a user rolls back to legacy alerting after having migrated to unified alerting, they will only get the legacy alerts they had right before migration.

## Roll back to legacy alerting

Although we encourage you to use Grafana alerting, roll back to legacy alerting is supported in Grafana 9. Rolling back can result in data loss (you will loose all alerts that you created using Grafana alerting). This is applicable to the fresh installation as well as upgraded setups.

Legacy alerting will be deprecated in v10 (a future release).
