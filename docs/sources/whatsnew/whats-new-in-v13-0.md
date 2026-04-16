---
description: Feature and improvement highlights for Grafana v13.0
keywords:
  - grafana
  - new
  - documentation
  - '13.0'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: What's new in Grafana v13.0
posts:
  - title: Git Sync
    items:
      - whats-new/2026-04-13-git-sync-for-grafana-dashboards-and-folders-now-generally-available.md
  - title: Dashboards and visualizations
    items:
      - whats-new/2026-04-02-dynamic-dashboards-is-now-generally-available.md
      - whats-new/2026-02-08-customize-dashboard-templates-with-grafana-assistant.md
      - whats-new/2026-02-24-substitute-template-variables-in-saved-queries.md
      - whats-new/2026-04-02-grafana-advanced-filtering.md
      - whats-new/2026-04-09-restore-deleted-dashboards-general-availability.md
      - whats-new/2026-03-05-revamped-gauge-visualization-is-generally-available.md
      - whats-new/2026-04-10-ad-hoc-filters-renamed-filters.md
      - whats-new/2026-03-15-legend-series-limit.md
      - whats-new/2026-03-30-visualization-presets.md
      - whats-new/2026-03-19-annotation-updates.md
      - whats-new/2026-04-01-copy-and-paste-panel-styles.md
      - whats-new/2026-03-26-stop-juggling-dashboards-with-section-level-variables.md
      - whats-new/2026-04-01-customize-suggested-dashboards-with-grafana-assistant.md
      - whats-new/2026-04-02-dashboards-faster-panel-creation-with-saved-queries-visualization-suggestions.md
      - whats-new/2026-03-20-saved-queries-new-interface-and-improved-filtering-experience.md
      - whats-new/2026-03-31-updated-visualization-suggestions-now-generally-available.md
      - whats-new/2026-04-08-new-panel-graphviz.md
      - whats-new/2026-04-01-query-experience-next.md
  - title: AI
    items:
      - whats-new/2026-04-03-sql-expressions-support-in-grafana-assistant.md
  - title: Data sources
    items:
      - whats-new/2026-04-07-query-your-elasticsearch-data-with-more-flexibility-using-dsl-and-es-ql.md
      - whats-new/2026-02-24-explore-ibm-db2-data-directly-from-grafana.md
  - title: Plugins
    items:
      - whats-new/2026-04-03-grafana-advisor-is-now-ga-health-checks-for-your-grafana-instance-to-keep-things-running-smoothly.md
  - title: Alerting
    items:
      - whats-new/2026-04-07-alerting-provenance-permissions-now-enforced-on-kubernetes-style-notification-apis.md
  - title: Other
    items:
      - whats-new/2026-03-30-pre-scenes-architecture-feature-toggle-removal.md
      - whats-new/2026-03-04-grafana-database-metrics-deprecation.md
  - title: Breaking changes
    items:
      - whats-new/2026-02-18-auditing-changed-defaults-for-data-source-queries-audit-logging-settings.md
      - whats-new/2026-02-18-query-caching-removal-of-duplicated-metrics.md
      - whats-new/2026-02-23-unified-storage-for-folders-and-dashboards.md
      - whats-new/2026-02-27-image-renderer-plugin-support-removed.md
      - whats-new/2026-03-31-rendering-default-auth-mode-changed-to-use-jwts.md
      - whats-new/2026-03-13-deprecation-and-removal-timeline-for-config-apps-and-config-panels-in-grafana-runtime.md
      - whats-new/2026-03-25-removal-of-grafana-cli-and-grafana-server-commands.md
      - whats-new/2026-03-24-deprecated-data-source-apis-disabled-by-default.md
      - whats-new/2026-03-24-http-compression-now-enabled-by-default.md
      - whats-new/2026-03-26-alertmanager-status-endpoint-requires-a-new-permission.md
      - whats-new/2026-03-26-legacy-alertmanager-configuration-api-endpoints-changed.md
      - whats-new/2026-04-07-twinmaker-sceneviewer-panel-unavailable.md
      - whats-new/2026-04-08-removal-deprecated-components-from-grafana-ui.md
whats_new_grafana_version: 13.0
weight: -54
---

# What’s new in Grafana v13.0

Welcome to Grafana 13.0! In this Grafana release we help solve the blinking cursor problem, helping teams to onboard and get insights from their data faster than ever. Easily take advantage of dashboards bundled with data sources or provided by the community, use templates to build faster and more consistently, save and share queries between your teams, and take the guess work out of panel choices with recommended suggestions.

Dynamic dashboards, our next generation of dashboarding, reaches general availability. The increased flexibility and adaptability makes building dashboards delightful, and helps teams consolidate and share a single source of truth. Additionally reaching general availability, Git Sync allows powerful bidirectional GitOps-helping you to manage your Grafana resources reliably at scale.

And that’s not all. There is a lot more to discover in Grafana 13, from the new Gauge visualization, new data sources, improved annotations, the list goes on. Read on to find out more and try for yourself.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v13.0, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v13.0/).

## Breaking changes in Grafana v13.0

For Grafana v13.0, we've also provided a list of [breaking changes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/whatsnew/whats-new-in-v13-0/#breaking-changes) to help you upgrade with greater confidence.

{{< docs/whats-new  >}}
