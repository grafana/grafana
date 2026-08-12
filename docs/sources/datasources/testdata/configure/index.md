---
aliases:
  - ../../data-sources/testdata/
description: Configure the TestData data source in Grafana.
keywords:
  - grafana
  - testdata
  - configure
  - data source
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the TestData data source
weight: 100
review_date: '2026-04-08'
---

# Configure the TestData data source

This document explains how to configure the TestData data source. TestData requires no external connection or authentication, so configuration is minimal.

For general information on managing data sources, refer to [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

## Before you begin

You must have the Organization administrator role to add and configure data sources.

## Add the data source

To add the TestData data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `TestData` in the search bar.
1. Select **TestData**.
1. Click **Add new data source**.

Grafana takes you to the **Settings** tab.

## Configuration options

TestData doesn't require any settings beyond the standard options common to all data sources.

| Setting     | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Name**    | Sets the name you use to refer to the data source in panels and queries. |
| **Default** | Defines whether this data source is pre-selected for new panels.         |

## Verify the connection

Click **Save & test** to verify the data source. A successful test displays the message:

**Data source is working**

If the test fails, refer to [Troubleshoot TestData](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/troubleshooting/) for common issues and solutions.

## Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system. For more information about provisioning, refer to [Provisioning data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

TestData doesn't require any `jsonData` or `secureJsonData` fields.

**YAML example**

```yaml
apiVersion: 1

datasources:
  - name: TestData
    type: grafana-testdata-datasource
    access: proxy
```

## Provision with Terraform

To provision the data source with Terraform, use the [`grafana_data_source` resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source):

```hcl
resource "grafana_data_source" "testdata" {
  name = "TestData"
  type = "grafana-testdata-datasource"
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Next steps

After configuring your TestData data source, you can:

- [Write queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/query-editor/) using the 30 available scenarios to generate simulated data.
- [Use template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/template-variables/) to create dynamic, reusable dashboards.
- [Set up alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/alerting/) to prototype and test alert rules with simulated data.
- [Troubleshoot issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/troubleshooting/) if you encounter problems with your data source.
