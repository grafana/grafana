---
description: Guide for upgrading to Grafana v9.4
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v9.4
menutitle: Upgrade to v9.4
weight: 1995
---

# Upgrade to Grafana v9.4

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

There are no additional upgrade steps to complete for this version of Grafana.

> Note: The upgrade to Grafana v9.4 makes changes to the Grafana Database for Grafana Alerting that are backwards incompatible, as such once upgraded to v9.4 of Grafana, your Grafana instance should not be downgraded to an earlier version. Doing so could cause issues with managing your Grafana Alerts.
