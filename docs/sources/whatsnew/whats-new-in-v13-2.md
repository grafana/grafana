---
description: Feature and improvement highlights for Grafana v13.2
keywords:
  - grafana
  - new
  - documentation
  - '13.2'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v13.2
posts:
  - title: Authentication and authorization
    items:
      - whats-new/2026-06-24-google-workload-identity-federation-for-bigquery-and-google-cloud-monitoring.md
  - title: Dashboards and visualizations
    items:
      - whats-new/2026-06-25-variables-and-annotations-removed-from-dashboards-settings-page.md
      - whats-new/2026-06-30-redesigned-query-variable-editor.md
      - whats-new/2026-07-18-saved-queries-is-now-generally-available-with-command-palette-and-provisioning-support.md
  - title: Data sources
    items:
      - whats-new/2026-07-28-opensearch-added-index-browser-to-datasource-configuration-and-query.md
whats_new_grafana_version: 13.2
weight: -56
---

# What's new in Grafana v13.2

Welcome to Grafana 13.2!

This release helps you build dashboards with less setup, connect more of your data securely, and get answers across your whole stack without leaving Grafana. Apply quick filters and grouping without configuring template variables, scope variables to the rows and tabs where they belong, and copy panel styling in a couple of clicks. Git Sync matures with verified commits, dashboard import, and root-level sync, bringing auditable GitOps to teams that require signed commits and branch protection. And Grafana Assistant now queries Snowflake, Jira, Dynatrace, and five more sources directly, so you can ask questions across your databases and observability data in one place.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v13.1, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v13.1/).

{{< docs/whats-new  >}}
