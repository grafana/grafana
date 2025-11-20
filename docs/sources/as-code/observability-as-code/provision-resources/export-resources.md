---
description: Export non-provisioned resources from Grafana.
keywords:
  - dashboards
  - resources
  - git sync
  - github
  - export
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Export resources
weight: 400
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/export-resources/
---

# Export non-provisioned resources from Grafana

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided. You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync and local file provisioning are [experimental features](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.

{{< /admonition >}}

Using Provisioning, you can choose to store your dashboard JSON files in either GitHub repositories using Git Sync or a local file path.

For more information, refer to the [Dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/) documentation.

## Provisioning methods

