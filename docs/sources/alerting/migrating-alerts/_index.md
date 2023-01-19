---
aliases:
  - difference-old-new/
  - unified-alerting/
  - unified-alerting/difference-old-new/
description: Upgrade Grafana alerts
title: Upgrade Alerting
weight: 110
---

# Upgrade Alerting

Grafana Alerting is enabled by default for new installations or existing installations whether or not legacy alerting is configured.

> **Note**: When upgrading, your dashboard alerts are migrated to a new format. This migration can be rolled back easily by [opting out]({{< relref "opt-out/" >}}). If you have any questions regarding this migration, please contact us.

Existing installations that do not use legacy alerting will have Grafana Alerting enabled by default unless alerting is disabled in the configuration.

Likewise, existing installations that use legacy alerting will be automatically upgraded to Grafana Alerting unless you have [opted out]({{< relref "opt-out/" >}}) of Grafana Alerting before migration takes place. During the upgrade, legacy alerts are migrated to the new alerts type and no alerts or alerting data are lost.

Once the upgrade has taken place, you still have the option to [roll back]({{< relref "roll-back/" >}}) to legacy alerting. However, we do not recommend choosing this option. If you do choose to roll back, Grafana will restore your alerts to the alerts you had at the point in time when the upgrade took place. All new alerts and changes made exclusively in Grafana Alerting will be deleted.

> **Note**: Cloud customers, who do not want to upgrade to Grafana Alerting, should contact customer support.

If you have opted out or rolled back, you can always choose to [opt in]({{< relref "opt-in/" >}}) to Grafana Alerting at a later point in time.

The following table provides details on the upgrade for Cloud, Enterprise, and OSS installations and the new Grafana Alerting UI.

| Grafana instance upgraded to 9.0 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cloud                            | Existing Cloud installations with legacy dashboard alerting will have two alerting icons in the left navigation panel - the old alerting plugin icon and the new Grafana Alerting icon. During upgrade, existing alerts from the Cloud alerting plugin are migrated to Grafana Alerting. Once migration is complete, you can access and manage the older alerts from the new alerting Grafana Alerting icon in the navigation panel. The (older) Cloud alerting plugin is uninstalled from your cloud instance. Contact customer support if you **do not wish** to migrate to Grafana Alerting for your Cloud stack. If you choose to use legacy alerting, use the You will see the new Grafana Alerting icon as well as the old Cloud alerting plugin in the left navigation panel. |
| Enterprise                       | Existing Enterprise instances using legacy alerting will have both the old (marked as legacy) and the new alerting icons in the navigation panel. During upgrade, existing legacy alerts are migrated to Grafana Alerting. If you wish, you can [opt-out]({{< relref "opt-out/" >}}) of Grafana Alerting and roll back to legacy alerting. In that case, you can manage your legacy alerts from the alerting icon marked as legacy.                                                                                                                                                                                                                                                                                                                                                  |
| OSS                              | Existing OSS installations with legacy dashboard alerting will have two alerting icons in the left navigation panel - the old alerting icon (marked as legacy) and the new Grafana Alerting icon. During upgrade, existing legacy alerts are migrated to Grafana Alerting. If you wish, you can [opt-out]({{< relref "opt-out/" >}}) of Grafana Alerting and roll back to legacy alerting. In that case, you can manage your legacy alerts from the alerting icon marked as legacy.                                                                                                                                                                                                                                                                                                  |

> **Note:** Legacy alerting will be deprecated in a future release (v10).
