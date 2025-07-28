---
description: Feature and improvement highlights for Grafana v12.1
keywords:
  - grafana
  - new
  - documentation
  - '12.1'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v12.1
posts:
  - title: Data sources
    items:
      - whats-new/2025-06-11-logicmonitor-enterprise-data-source-for-grafana.md
      - whats-new/2025-06-20-support-for-service-account-impersonation-in-bigquery.md
      - whats-new/2025-07-08-keep-instances-running-smoothly-with-grafana-advisor.md
  - title: Alerting
    items:
      - whats-new/2025-07-11-alert-rule-list-page-updates.md
      - whats-new/2025-07-09-active-time-intervals-in-grafana-alerting.md
      - whats-new/2025-07-14-add-ability-to-import-rules-to-gma-from-prometheus-yaml.md
  - title: Dashboards and visualizations
    items:
      - whats-new/2025-06-30-transformations-regression-analysis.md
      - whats-new/2025-07-14-custom-variable-support-in-visualization-actions.md
      - whats-new/2025-07-10-server-configurable-quick-time-ranges-for-dashboards.md
      - whats-new/2025-07-14-enhanced-custom-currency-format-display-exact-financial-values.md
  - title: Authentication and authorization
    items:
      - whats-new/2025-07-14-entra-id-workload-identity-support.md
whats_new_grafana_version: 12.1
weight: -50
---

# What’s new in Grafana v12.1

It’s 12.1 time! We’re really excited about GA for a new alert rule page that makes it easier to find what you need quickly, as well as the regression analysis transformation, helping you predict future data values or estimate missing data points that might not be exactly represented in the original dataset. Also, visualization actions now support custom variables. When triggered, actions prompt you to input whatever custom variable was defined, allowing you to tailor requests in real time without modifying dashboard configuration. This is super helpful for when you’re triggering alerts, filtering API calls, or sending user-defined parameters to external systems. And you can try out Grafana Advisor, which automatically detects plugin, data source, and SSO issues, keeping your Grafana instance healthy and secure.

Speaking of security, Grafana now supports Entra Workload Identity, simplifying OAuth and increasing security for instances using Microsoft Azure. Thanks to community contributor [mehighlow](https://github.com/mehighlow) for this feature!

We have one more community contributor to thank for this release. [Chris Hodges](https://github.com/chodges15) delivered server-configurable quick time ranges for dashboards. Now you can define custom time range presets for the time picker on dashboards, perfect for teams that routinely analyze specific, context-driven time windows.

Keep reading to learn about what else we have in store for 12.1.

{{< youtube id=Umy-kCKkMQM >}}

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v12.1, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v12.1/).

{{< docs/whats-new  >}}
