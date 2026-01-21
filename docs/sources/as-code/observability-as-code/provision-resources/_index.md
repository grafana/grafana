---
description: Learn about how to provision resources using local file provisioning administration.
keywords:
  - observability
  - configuration
  - as code
labels:
  products:
    - enterprise
    - oss
title: Provision resources on-prem
menuTitle: On-prem file provisioning 
weight: 400
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/
aliases:
  - ../../observability-as-code/provision-resources/ # /docs/grafana/next/observability-as-code/provision-resources/
---

# On-prem file provisioning 

{{< admonition type="caution" >}}

On-prem file provisioning is an [experimental feature](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions available in [nightly releases](https://grafana.com/grafana/download/nightly). It's **not available in Grafana Cloud**.

Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.

{{< /admonition >}}

On-prem local file provisioning allows you to configure how to store your dashboard JSON and other files from your local file system. You can set a single folder, or multiple folders to a different repository, with up to 10 connections. 

With on-prem file provisioning:

- All provisioned resources are changed in the local files.
- The dashboards saved in your GitHub repository or local folder appear in Grafana in the 'provisioned' folder. The dashboards and folders saved to the local path are referred to as 'provisioned' resources and are labeled as such in the Grafana UI. 
- Any changes made in the provisioned files are reflected in the Grafana database. The Grafana UI reads the database and updates the UI to reflect these changes.
- You can't use the Grafana UI to edit or delete provisioned resources.

## Explore file provisioning

{{< section withDescriptions="true" depth="5" >}}
