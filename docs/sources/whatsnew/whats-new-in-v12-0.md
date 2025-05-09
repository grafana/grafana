---
description: Feature and improvement highlights for Grafana v12.0
keywords:
  - grafana
  - new
  - documentation
  - '12.0'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v12.0
posts:
  - title: Observability as Code
    items:
      - docs/grafana-cloud/whats-new/2025-04-14-git-sync-for-grafana-dashboards.md
      - docs/grafana-cloud/whats-new/2025-04-11-new-dashboards-schema.md
      - docs/grafana-cloud/whats-new/2025-05-05-new-dashboard-apis-released-as-experimental.md
  - title: Drilldown apps
    items:
      - docs/grafana-cloud/whats-new/2025-04-28-metrics-drilldown-improvements.md
      - docs/grafana-cloud/whats-new/2025-04-28-logs-drilldown-improvements.md
      - docs/grafana-cloud/whats-new/2025-04-17-ga-release-of-grafana-traces-drilldown.md
      - docs/grafana-cloud/whats-new/2025-04-28-introducing-investigations
  - title: Cloud Migration Assistant
    items:
      - docs/grafana-cloud/whats-new/2025-04-11-grafana-cloud-migration-assistant-now-generally-available.md
  - title: Dashboards and visualizations
    items:
      - docs/grafana-cloud/whats-new/2025-04-11-dynamic-dashboards.md
      - docs/grafana-cloud/whats-new/2025-04-11-blazing-fast-table-panel.md
      - docs/grafana-cloud/whats-new/2025-04-07-sql-expressions.md
  - title: Authentication and authorization
    items:
      - docs/grafana-cloud/whats-new/2025-04-14-scim-user-and-team-provisioning.md
  - title: Alerting
    items:
      - docs/grafana-cloud/whats-new/2025-04-10-alert-rule-migration-tool.md
      - docs/grafana-cloud/whats-new/2025-04-10-grafana-managed-alert-rule-recovering-state.md
      - docs/grafana-cloud/whats-new/2025-04-11-grafana-managed-alert-rule-improvements.md
  - title: Experimental themes
    items:
      - docs/grafana-cloud/whats-new/2025-04-10-experimental-themes.md
  - title: Explore
    items:
      - docs/grafana-cloud/whats-new/2025-04-15-new-controls-for-logs-in-explore.md
  - title: Traces
    items:
      - docs/grafana-cloud/whats-new/2025-04-30-trace-correlations-instant-context-hops-from-any-trace.md
  - title: Breaking Changes
    items:
      - docs/grafana-cloud/whats-new/2025-04-28-removal-of-editors_can_admin-configuration.md
      - docs/grafana-cloud/whats-new/2025-04-28-dashboard-v2-schema-and-next-gen-dashboards.md
      - docs/grafana-cloud/whats-new/2025-04-29-deduplication-and-renaming-of-metric-cache_size.md
      - docs/grafana-cloud/whats-new/2025-04-28-removal-of-optional-actions-property-from-datalinkscontextmenu-component.md
      - docs/grafana-cloud/whats-new/2025-04-29-enforcing-stricter-data-source-uid-format.md
      - docs/grafana-cloud/whats-new/2025-04-28-removal-of-angular.md
      - docs/grafana-cloud/whats-new/2025-04-29-deprecated-apis-for-ui-extensions-will-be-removed.md
      - docs/grafana-cloud/whats-new/2025-04-29-enforcing-stricter-version-compatibility-checks-in-plugin-cli-install-commands.md
      - docs/grafana-cloud/whats-new/2025-04-28-removal-of-‘aggregate-by’-in-tempo.md
      - docs/grafana-cloud/whats-new/2025-04-28-removing-the-feature-toggle-ui-from-grafana-cloud.md
whats_new_grafana_version: 12.0
weight: -49
---

# What’s new in Grafana v12.0

Welcome to Grafana 12.0! We have a _lot_ to share. This release marks general availability for Grafana Drilldown (previously Explore Metrics, Logs, and Traces), Grafana-managed alerts and recording rules, Cloud migration, and plugin management tooling. You can also try new [preview and experimental](https://grafana.com/docs/release-life-cycle/) tools: Sync your dashboards directly to a GitHub repository with Git Sync, and try our new Terraform provider and CLI. Add tabs, new layouts and conditional logic to your dashboards, and load tables and geomaps far faster. Join and transform data limitlessly from multiple sources with SQL Expressions. In Grafana Cloud and Enterprise, sync your users and teams instantly from your SAML identity provider using SCIM (the System for Cross-Domain Identity Management). Lastly, don't forget to try on one of several new color themes for the user interface.

Read on to learn about these and more improvements to Grafana!

{{< youtube id=4uJkHC-IvGU >}}

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v12.0, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v12.0/).

## Breaking changes in Grafana v12.0

For Grafana v12.0, we've also provided a list of [breaking changes](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v12-0/#breaking-changes) to help you upgrade with greater confidence. For our purposes, a breaking change is any change that requires users or operators to do something. This includes:

- Changes in one part of the system that could cause other components to fail
- Deprecations or removal of a feature
- Changes to an API that could break automation
- Changes that affect some plugins or functions of Grafana
- Migrations that can’t be rolled back

For each change, the provided information:

- Helps you determine if you’re affected
- Describes the change or relevant background information
- Guides you in how to mitigate for the change or migrate
- Provides more learning resources

{{< docs/whats-new  >}}
