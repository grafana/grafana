---
description: Feature and improvement highlights for Grafana v11.6
keywords:
  - grafana
  - new
  - documentation
  - '11.6'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v11.6
posts:
  - title: Dashboards and visualizations
    items:
      - whats-new/2025-02-11-canvas-one-click-data-links-and-actions.md
      - whats-new/2025-02-11-one-click-data-links-and-actions-in-visualizations.md
      - whats-new/2025-02-14-actions-added-to-visualizations.md
      - whats-new/2025-02-26-new-actionscell-for-table-visualization.md
      - whats-new/2025-02-19-better-time-region-control-with-cron-syntax.md
      - whats-new/2025-03-06-improved-performance-in-geomap-visualizations.md
      - whats-new/2025-03-06-variables-supported-for-all-transformations.md
  - title: Alerting
    items:
      - whats-new/2025-03-05-alert-rule-version-history.md
      - whats-new/2025-03-05-alerting-support-for-jira-service-management-contact-point.md
  - title: Data sources
    items:
      - whats-new/2025-02-28-lbac-for-datasources-metrics.md
  - title: Plugins
    items:
      - whats-new/2025-03-12-plugin-details-links-improvements.md
  - title: Security
    items:
      - whats-new/2025-02-10-auto-migration-of-api-keys-to-service-accounts.md
whats_new_grafana_version: 11.6
weight: -48
---

# What’s new in Grafana v11.6

Welcome to Grafana 11.6! This minor release includes a number of dashboarding features that are now generally available including one-click data links and actions, Cron syntax support for annotations, and WebGL-powered geomaps for better performance. We've also fully migrated from API keys to service accounts in Grafana for better security. Read on to learn more about version history for Grafana Managed Alerts, label-based access control (LBAC) for Mimir metrics, and more in Grafana v11.6.

{{< youtube id=iF7yxO4nUXQ >}}

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.6, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.6/).

{{< docs/whats-new  >}}
