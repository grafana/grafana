+++
title = "Opt-in to Unified Alerts"
description = "How to enable Unified Alerts"
+++

# Enable Unified Alerts
Setting the `ngalert` feature toggle enables the new Unified Alerts system.

>**Note:** It is recommended to backup Grafana's database before enabling this feature.

At startup, when the feature toggle is enabled, Grafana dashboard alerting is disabled and existing dashboard alerts are migrated into a format that is compatible with the Unified Alerting system. You are able to view these migrated rules, alongside any new alerts you create after the migration, from the Alerting page of your grafana installation.

During beta, the migration of existing dashboard rules may change.

## Disabling Unified Alerts after migration
To disable Unified Alerts, remove or disable the `ngalert` feature toggle. Dashboard alerts will be re-enabled and any alerts created during or after the migration are deleted.

>**Note:** Any alerting rules created in the Unified Alerting system will be lost when migrating back to dashboard alerts
