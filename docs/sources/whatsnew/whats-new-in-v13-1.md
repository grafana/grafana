---
description: Feature and improvement highlights for Grafana v13.1
keywords:
  - grafana
  - new
  - documentation
  - '13.1'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v13.1
posts:
  - title: Git Sync
    items:
      - whats-new/2026-06-10-git-sync-ui-import-feature.md
      - whats-new/2026-06-10-git-sync-folderless-synchronization.md
      - whats-new/2026-06-10-git-sync-folder-readme.md
      - whats-new/2026-06-11-git-sync-verified-commits.md
  - title: Dashboards and visualizations
    items:
      - whats-new/2026-06-22-mapping-one-variable-to-multiple-values-generally-available.md
      - whats-new/2026-04-22-time-series-to-table-transformation-is-now-generally-available.md
      - whats-new/2026-05-05-annotations-clustering-now-generally-available.md
      - whats-new/2026-05-26-copy-and-paste-panel-styles-are-now-generally-available.md
      - whats-new/2026-06-12-quick-filters-and-data-grouping-are-now-generally-available.md
      - whats-new/2026-05-26-panel-styles-are-now-generally-available.md
      - whats-new/2026-04-30-flexible-grouping-rules-and-field-overrides-for-nested-tables.md
      - whats-new/2026-05-08-faceted-filter-for-time-series-legends.md
      - whats-new/2026-06-11-add-variables-to-rows-and-tabs.md
      - whats-new/2026-06-18-sidebar-and-toolbar-improvements-for-the-new-dashboard-experience.md
      - whats-new/2026-06-11-revamped-query-editor-now-in-public-preview-with-multi-select-and-stacked-view.md
  - title: Grafana Assistant
    items:
      - whats-new/2026-06-23-grafana-assistant-is-now-pre-installed-in-grafana-enterprise.md
  - title: Data sources
    items:
      - whats-new/2026-06-11-pdc-now-supports-mqtt-github-and-ibm-db2.md
whats_new_grafana_version: 13.1
weight: -55
---

# What's new in Grafana v13.1

Welcome to Grafana 13.1!

This release helps you build dashboards with less setup, connect more of your data securely, and get answers across your whole stack without leaving Grafana. Apply quick filters and grouping without configuring template variables, scope variables to the rows and tabs where they belong, and copy panel styling in a couple of clicks. Git Sync matures with verified commits, dashboard import, and root-level sync, bringing auditable GitOps to teams that require signed commits and branch protection. And Grafana Assistant now queries Snowflake, Jira, Dynatrace, and five more sources directly, so you can ask questions across your databases and observability data in one place.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v13.1, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v13.1/).

{{< docs/whats-new  >}}
