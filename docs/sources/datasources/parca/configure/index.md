---
aliases:
  - ../../parca/
description: Configure the Parca data source in Grafana to connect to your Parca
  continuous profiling instance.
keywords:
  - grafana
  - parca
  - configure
  - profiling
  - data source
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure Parca
title: Configure the Parca data source
weight: 200
review_date: 2026-04-10
---

# Configure the Parca data source

This page explains how to configure the Parca data source in Grafana.

You can configure the data source using either the data source settings interface in Grafana or a YAML provisioning file.
If you make any changes, select **Save & test** to preserve those changes.

## Before you begin

Before configuring the data source, ensure you have:

- **Grafana permissions:** Organization administrator role.
- **Parca instance:** A running Parca instance (v0.19 or later) accessible from your Grafana server.

If you're provisioning the data source, you also need administrative rights on the server hosting your Grafana instance.

## Add the data source

To add the Parca data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Parca` in the search bar.
1. Select **Parca**.
1. Click **Add new data source**.

## Configure settings

The **Settings** tab contains the following configuration sections.

### Connection

| Setting | Description                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL** | The URL of your Parca instance. For example, `http://localhost:7070`. Grafana connects to Parca using gRPC-Web, so the URL should point to the Parca HTTP endpoint. |

### Authentication

Use this section to select an authentication method to access the data source.

The Parca data source supports the standard Grafana authentication options, including basic authentication and custom headers.

{{< admonition type="note" >}}
Use Transport Layer Security (TLS) for an additional layer of security when working with Parca.
{{< /admonition >}}

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-authentication.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

## Additional settings

Use the down arrow to expand the **Additional settings** section to view these options.

### Advanced HTTP settings

The Grafana proxy deletes forwarded cookies. Use the **Allowed cookies** field to specify cookies that should be forwarded to the data source by name.

The **Timeout** field sets the HTTP request timeout in seconds.

### Private data source connect

[//]: # 'Shared content for private data source connect in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-private-ds-connect.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

## Verify the connection

Click **Save & test** to verify that Grafana can connect to your Parca instance. The health check queries the available profile types from the Parca server. If the connection is successful, a confirmation message appears.

If the test fails, verify that the URL is correct and that your Parca instance is running and accessible from the Grafana server.

## Provision the data source

You can define the data source in YAML files as part of Grafana's provisioning system.
For more information, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    url: http://localhost:7070
```

## Next steps

- [Query profiling data with the Parca query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/query-editor/)
