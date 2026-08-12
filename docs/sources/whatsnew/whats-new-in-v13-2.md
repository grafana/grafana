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
      - whats-new/2026-07-08-organize-dashboards-faster-with-multi-select-grouping.md
      - whats-new/2026-07-18-saved-queries-is-now-generally-available-with-command-palette-and-provisioning-support.md
  - title: Data sources
    items:
      - whats-new/2026-07-28-opensearch-added-index-browser-to-datasource-configuration-and-query.md
      - whats-new/2026-08-03-oracle-easy-connect-plus-support.md
whats_new_grafana_version: 13.2
weight: -56
---

# What's new in Grafana v13.2

Welcome to Grafana 13.2!

This release helps you share and reuse trusted queries to get answers faster and more easily onboard team members, dig into crowded panels without leaving the dashboard, and securely connect to your data with fewer long-lived secrets to manage.

Saved queries are now generally available in Grafana Enterprise and Grafana Cloud, helping individual's knowledge become a library everyone can draw on: find them from anywhere using the command palette (cmd/ctrl+K) then quickly jump into Explore, and reliably manage them as code with Terraform.

View panel mode gains a controls sidebar in public preview, so you can adjust visualization options without edit permissions and fan a busy time series out into one graph per series or label to see which one is actually moving. Query variables get a redesigned editor, OpenSearch adds an index picker to configuration and query editing, and BigQuery and Google Cloud Monitoring can now authenticate with Google Workload Identity Federation in Grafana Cloud instead of a service account key file.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v13.2, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v13.2/).

{{< docs/whats-new  >}}
