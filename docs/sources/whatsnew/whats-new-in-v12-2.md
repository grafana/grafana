---
description: Feature and improvement highlights for Grafana v12.2
keywords:
  - grafana
  - new
  - documentation
  - '12.2'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v12.2
posts:
  - title: SQL expressions
    items:
      - whats-new/2025-09-05-sql-expressions.md
  - title: Dashboards and visualizations
    items:
      - whats-new/2025-08-22-new-table-visualization-is-generally-available.md
      - whats-new/2025-08-27-generate-tooltips-from-table-fields.md
      - whats-new/2025-08-27-improved-footer-for-table-visualization.md
      - whats-new/2025-07-17-disable-tooltips-in-canvas-visualizations.md
      - whats-new/2025-07-14-static-options-for-query-variable.md
      - whats-new/2025-07-24-dynamic-connection-direction-in-canvas.md
      - whats-new/2025-08-04-canvas-pan-zoom-improvements.md
      - whats-new/2025-09-01-actions-authentication-via-infinity-datasource.md
      - whats-new/2025-09-02-enhanced-ad-hoc-filter-support.md
      - whats-new/2025-09-02-new-dashboard-apis-now-enabled-by-default.md
  - title: Reporting
    items:
      - whats-new/2025-05-27-new-and-improved-reporting.md
  - title: Data sources
    items:
      - whats-new/2025-08-12-jenkins-enterprise-data-source-for-grafana.md
      - whats-new/2025-07-16-google-sheets-data-source-now-supports-template-variables.md
      - whats-new/2025-09-04-azure-monitor-resource-picker-filtering-and-recent-resources.md
  - title: Explore
    items:
      - whats-new/2025-07-08-saved-queries-in-dashboards-and-explore.md
  - title: Logs Drilldown
    items:
      - whats-new/2025-08-29-json-log-line-viewer-in-logs-drilldown-is-now-generally-available.md
  - title: Metrics Drilldown
    items:
      - whats-new/2025-08-07-grafana-metrics-drilldown-entry-point-from-alerting-rule.md
  - title: Plugins
    items:
      - whats-new/2025-09-11-translate-your-plugin.md
  - title: Authentication and authorization
    items:
      - whats-new/2025-09-10-scim-configuration-ui.md
whats_new_grafana_version: 12.2
weight: -51
---

# What’s new in Grafana v12.2

Welcome to Grafana 12.2! This release focuses on making it easier to gain insights from your data.

We're excited to announce several features are now GA. Enhanced ad hoc filtering transforms your dashboards into true command centers, allowing you to slice and dice datasets on the fly. The redesigned table visualization offers improved performance and visual aids for quick pattern and anomaly identification, helping you make faster decisions. The Logs Drilldown JSON viewer makes intimidating log structures organized and explorable. Metrics Drilldown now integrates with alert creation in Grafana, so you can explore Prometheus data with intuitive point-and-click interactions, find the right visualization, and easily use its query in your alert rule.

We're also collecting feedback on some new public preview features. AI-powered SQL expressions eliminate the barrier between questions and answers by generating SQL queries from natural language and providing instant explanations for existing queries. Our enhanced Canvas Pan and Zoom experience lets you design complex dashboards exactly as you envision them.

Keep reading to learn more about everything 12.2 has in store.

{{< youtube id=-7A_tePidEM >}}

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v12.2, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v12.2/).

{{< docs/whats-new  >}}
