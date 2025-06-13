---
aliases:
  - /docs/grafana-cloud/account-management/e2c-guide/
  - /docs/grafana-cloud/account-management/migration-guide/
description: Migrate from Grafana OSS/Enterprise to Grafana Cloud
keywords:
  - Grafana Cloud
  - Grafana Enterprise
  - Grafana OSS
menuTitle: Migrate from Grafana OSS/Enterprise to Grafana Cloud
title: Migrate from Grafana OSS/Enterprise to Grafana Cloud
---

# Migrate from Grafana OSS/Enterprise to Grafana Cloud

When you decide to migrate from your self-managed Grafana instance to Grafana Cloud, you can benefit from the convenience of a managed observability platform, additional cloud-only features, and robust security. There are a couple of key approaches to help you transition to Grafana Cloud.

| Migration type | Tools used                                                            | Availability                                                                                                                                                                                                     | Migratable resources                                                                                                                                                  |
| :------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual         | <ul><li>Command line utilities</li><li>The Grafana HTTP API</li></ul> | Generally available in all versions of Grafana OSS/Enterprise                                                                                                                                                    | The entire Grafana instance                                                                                                                                           |
| Automated      | The Grafana Cloud Migration Assistant                                 | Generally available in Grafana v12 and available in public preview from Grafana v11.2 to v11.6 using the `onPremToCloudMigrations` feature toggle. This toggle is enabled by default in Grafana v11.5 and later. | <ul><li>Dashboards</li><li>Folders</li><li>Data sources</li><li>App Plugins</li><li>Panel Plugins</li><li>Library Panels</li><li>Grafana Alerting resources</li></ul> |

Our detailed [migration guide](https://grafana.com/docs/grafana-cloud/account-management/migration-guide/manually-migrate-to-grafana-cloud/) explains the key steps and scripts to manually migrate your resources to Grafana Cloud, covering a comprehensive set of resources in your Grafana instance. Alternatively, the [Grafana Cloud Migration Assistant](https://grafana.com/docs/grafana-cloud/account-management/migration-guide/cloud-migration-assistant/), available in public preview in Grafana v11.2 and later, automates the migration process across a broad range of Grafana resources. You can use the migration assistant to migrate a large proportion of your Grafana resources and then, if needed, leverage the migration guide to migrate the rest.
