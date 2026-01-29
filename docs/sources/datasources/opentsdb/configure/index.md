---
aliases:
  - ../../data-sources/opentsdb/configure/
description: Configure the OpenTSDB data source in Grafana
keywords:
  - grafana
  - opentsdb
  - configuration
  - provisioning
  - terraform
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the OpenTSDB data source
weight: 100
last_reviewed: 2026-01-28
refs:
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  troubleshooting-opentsdb:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/troubleshooting/
---

# Configure the OpenTSDB data source

This document explains how to configure the OpenTSDB data source in Grafana.

## Before you begin

Before configuring the OpenTSDB data source, ensure you have:

- **Grafana permissions:** Organization administrator role to add data sources.
- **OpenTSDB instance:** A running OpenTSDB server (version 2.1 or later recommended).
- **Network access:** The Grafana server can reach the OpenTSDB HTTP API endpoint (default port 4242).
- **Metrics in OpenTSDB:** For autocomplete to work, metrics must exist in your OpenTSDB database.

## Add the data source

To add and configure the OpenTSDB data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `OpenTSDB` in the search bar.
1. Select **OpenTSDB**.
1. Click **Add new data source** in the upper right.
1. Configure the data source settings as described in the following sections.

## Configuration options

The following table describes the available configuration options:

| Setting | Description |
| ------- | ----------- |
| **Name** | The data source name. This is how you refer to the data source in panels and queries. |
| **Default** | Toggle to make this the default data source for new panels. |
| **URL** | The HTTP protocol, IP address, and port of your OpenTSDB server. The default port is `4242`. Example: `http://localhost:4242`. |
| **Allowed cookies** | Cookies to forward to the data source. Use this when your OpenTSDB server requires specific cookies for authentication. |
| **Timeout** | HTTP request timeout in seconds. Increase this value for slow networks or complex queries. |

## OpenTSDB settings

Configure these settings based on your OpenTSDB server version and configuration:

| Setting | Description |
| ------- | ----------- |
| **Version** | Select your OpenTSDB version. Options: `<=2.1`, `==2.2`, `==2.3`, `==2.4`. This affects available query features such as filters and fill policies. |
| **Resolution** | The resolution of your metric data. Select `second` for second-precision timestamps or `millisecond` for millisecond-precision timestamps. |
| **Lookup limit** | Maximum number of results returned by suggest and lookup API calls. Default is `1000`. Increase this if you have many metrics or tag values. |

## Verify the connection

Click **Save & test** to verify that Grafana can connect to your OpenTSDB server. A successful test confirms that the URL is correct and the server is responding.

If the test fails, refer to [Troubleshooting](ref:troubleshooting-opentsdb) for common issues and solutions.

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system. For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

### YAML example

The following example provisions an OpenTSDB data source with all available options:

```yaml
apiVersion: 1

datasources:
  - name: OpenTSDB
    type: opentsdb
    access: proxy
    url: http://localhost:4242
    basicAuth: false
    jsonData:
      # OpenTSDB version: 1 = <=2.1, 2 = 2.2, 3 = 2.3, 4 = 2.4
      tsdbVersion: 3
      # Resolution: 1 = second, 2 = millisecond
      tsdbResolution: 1
      # Maximum results for suggest/lookup API calls
      lookupLimit: 1000
```

The following table describes the `jsonData` fields:

| Field | Description | Values |
| ----- | ----------- | ------ |
| `tsdbVersion` | OpenTSDB version. | `1` (<=2.1), `2` (2.2), `3` (2.3), `4` (2.4) |
| `tsdbResolution` | Timestamp resolution. | `1` (second), `2` (millisecond) |
| `lookupLimit` | Maximum results for suggest and lookup API calls. | Default: `1000` |

## Provision with Terraform

You can provision the OpenTSDB data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

### Terraform example

The following example provisions an OpenTSDB data source:

```hcl
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 2.0.0"
    }
  }
}

provider "grafana" {
  url  = "<YOUR_GRAFANA_URL>"
  auth = "<YOUR_SERVICE_ACCOUNT_TOKEN>"
}

resource "grafana_data_source" "opentsdb" {
  type = "opentsdb"
  name = "OpenTSDB"
  url  = "http://localhost:4242"

  json_data_encoded = jsonencode({
    # OpenTSDB version: 1 = <=2.1, 2 = 2.2, 3 = 2.3, 4 = 2.4
    tsdbVersion = 3
    # Resolution: 1 = second, 2 = millisecond
    tsdbResolution = 1
    # Maximum results for suggest/lookup API calls
    lookupLimit = 1000
  })
}
```

Replace the following placeholders:

- _`<YOUR_GRAFANA_URL>`_: Your Grafana instance URL (for example, `https://your-org.grafana.net` for Grafana Cloud)
- _`<YOUR_SERVICE_ACCOUNT_TOKEN>`_: A service account token with data source permissions
