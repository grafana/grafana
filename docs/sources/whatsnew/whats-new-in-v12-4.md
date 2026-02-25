---
description: Feature and improvement highlights for Grafana v12.4
keywords:
  - grafana
  - new
  - documentation
  - '12.4'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v12.4
posts:
  - title: Dashboards and visualizations
    items:
      - whats-new/2026-02-04-git-sync-now-available-in-public-preview.md
      - whats-new/2026-01-02-dynamic-dashboards.md
      - whats-new/2025-11-18-create-dashboards-from-templates.md
      - whats-new/2025-12-02-suggested-dashboards-now-available.md
      - whats-new/2026-01-20-map-one-variable-to-multiple-values.md
      - whats-new/2025-12-10-apply-regex-to-variable-values-or-display-text.md
      - whats-new/2026-01-30-rbac-for-saved-queries.md
      - whats-new/2025-12-11-dashboard-controls-menu.md
      - whats-new/2025-12-31-visualization-suggestions-updates.md
      - whats-new/2025-12-31-revamped-gauge-panel.md
      - whats-new/2025-12-31-time-range-pan-zoom.md
      - whats-new/2026-01-13-datagrid-deprecation.md
  - title: Authentication and authorization
    items:
      - whats-new/2026-01-14-scim-user-and-team-provisioning.md
  - title: Data sources
    items:
      - whats-new/2026-02-05-falcon-logscale-data-source-supports-nextgen-siem.md
      - whats-new/2026-02-06-default-spreadsheets-in-the-google-sheets-data-source.md
      - whats-new/2026-01-16-zabbix-release-shared-dashboards-performance-boost-and-host-tag-filtering.md
  - title: Logs
    items:
      - whats-new/2026-01-05-enhanced-display-for-opentelemetry-log-lines.md
  - title: Logs Drilldown
    items:
      - whats-new/2026-02-13-default-columns-configuration-for-logs-drilldown.md
      - whats-new/2026-02-13-save-and-resume-log-explorations-in-logs-drilldown.md
  - title: Short URLs
    items:
      - whats-new/2026-01-27-short-urls-are-saved-indefinitely.md
  - title: Alerting
    items:
      - whats-new/2026-02-11-pending-period-added-to-alert-states.md
  - title: Breaking changes
    items:
      - whats-new/2025-12-17-unified-storage-for-playlists.md
      - whats-new/2026-01-08-automatic-storage-migration-for-small-instances.md
whats_new_grafana_version: 12.4
weight: -53
---

# What’s new in Grafana v12.4

Welcome to Grafana 12.4!

This release doubles down on dashboard automation and Git-powered workflows while delivering a range of polish and usability improvements.

The headline is improved dashboard productivity: Dynamic dashboards and template-driven workflows make it far easier to create, reuse, and operate dashboards at scale. Create dashboards from templates, map one variable to multiple values, apply regular expression transforms to variable values or display text, and benefit from smarter visualization suggestions and an updated gauge panel that help surface the right view for your data. At the same time, Git Sync is now available in public preview, providing a smooth Git-backed workflow to keep dashboards in source control and enable safer, auditable changes to dashboard content. These two areas together are aimed at speeding up development, improving consistency, and making dashboard CI/CD practical for teams.

Beyond dashboards, this version includes improvements across the product: Logs and Logs Drilldown get better default columns and save/resume log explorations, data sources receive sensible new defaults and expanded support, SCIM provisioning simplifies user and team management, short URLs are now persistent, and a small set of breaking changes and storage migration enhancements help ensure long-term manageability.

{{< youtube id=fWpL1Upc754 >}}

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v12.4, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v12.4/).

{{< docs/whats-new  >}}
