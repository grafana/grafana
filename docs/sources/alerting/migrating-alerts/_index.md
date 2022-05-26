---
aliases:
  - /docs/grafana/latest/alerting/migrating-alerts/
description: Migrate Grafana alerts
title: Migrate to Grafana alerting
weight: 113
---

# Migrate to Grafana alerting

Grafana alerting is the default for new Cloud, Enterprise, and OSS installations. The new installations will only show the Grafana alerting icon in the left navigation panel.

Existing installations that upgrade to v9.0 will have Grafana alerting enabled by default.

| Grafana instance upgraded to v 90 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud                             | Existing Cloud installations with legacy dashboard alerting will have two alerting icons in the left navigation panel - the old alerting plugin icon and the new Grafana alerting icon. During upgrade, existing alerts from the Cloud alerting plugin are migrated to Grafana alerting. Once migration is complete, you can access aman manage the older alerts from the new alerting Grafana alerting icon in the navigation panel. The (older) Cloud alerting plugin is uninstalled from your cloud instance. Contact customer support if you **do not wish** to migrate to Grafana alerting for your Cloud stack. If you choose to use legacy alerting, use the You will see the new Grafana alerting icon as well as the old Cloud alerting plugin in the left navigation panel. |
| Enterprise                        | Existing Enterprise instances using legacy alerting will have both the old (marked as legacy) and the new alerting icons in the navigation panel. During upgrade, existing legacy alerts are migrated to Grafana alerting. If you wish, you can [opt-out]({{< relref "./opt-out.md" >}}) of Grafana alerting and roll back to legacy alerting. In that case, you can manage your legacy alerts from the alerting icon marked as legacy.                                                                                                                                                                                                                                                                                                                                               |
| OSS                               | Existing OSS installations with legacy dashboard alerting will have two alerting icons in the left navigation panel - the old alerting icon (marked as legacy) and the new Grafana alerting icon. During upgrade, existing legacy alerts are migrated to Grafana alerting. If you wish, you can [opt-out]({{< relref "./opt-out.md" >}}) of Grafana alerting and roll back to legacy alerting. In that case, you can manage your legacy alerts from the alerting icon marked as legacy.                                                                                                                                                                                                                                                                                               |

During migration from legacy alerting to unified alerting, the legacy alerts are updated to the new alerts type, as a result, the user does not lose alerts or alerting data. However, if a user rolls back to legacy alerting after having migrated to unified alerting, they will only get the legacy alerts they had right before migration.

## Roll back to legacy alerting

Although we encourage you to use Grafana alerting, roll back to legacy alerting is supported in Grafana 9. Rolling back can result in data loss (you will loose all alerts that you created using Grafana alerting). This is applicable to the fresh installation as well as upgraded setups.

> **Note:** Legacy alerting will be deprecated in a future release (v10).
