+++
title = " Difference between unified and old Grafana alerts"
description = "Pause an existing alert rule"
keywords = ["grafana", "alerting", "guide", "rules", "view"]
weight = 112
+++

# Difference between unified and old Grafana alerts

The `ngalert` feature toggle enables the beta version of our new alerting system. 

>**Note:** It is recommended to backup Grafana's database before enabling this feature.

When the feature flag is enabled, dashboard alerting is disabled and dashboard alerts are migrated into the system. Going to "Alert List" will take you to the new system.

Once you disable the new alters, all migrated and newly created alerts in the new system are deleted, and dashboard alerting will be enabled again.

During beta, the migration of existing dashboard rules may change.