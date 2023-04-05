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

The upgrade to Grafana v9.4 includes changes to the Grafana database for Grafana alerting that are not backward compatible. As a result, when you upgrade to Grafana v9.4, do not downgrade your Grafana instance to an earlier version. Doing so might cause issues with managing your Grafana alerts.
