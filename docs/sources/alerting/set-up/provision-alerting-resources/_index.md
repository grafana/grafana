---
aliases:
  - ../provision-alerting-resources/
description: Provision alerting resources
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - provisioning
title: Provision Grafana Alerting resources
weight: 200
---

# Provision Grafana Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Grafana Alerting provisioning makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

There are three options to choose from:

1. Use file provisioning to provision your Grafana Alerting resources, such as alert rules and contact points, through files on disk.

1. Provision your alerting resources using the Alerting Provisioning HTTP API.

   For more information on the Alerting Provisioning HTTP API, refer to [Alerting provisioning API](https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/).

   **Note:**

   Typically, you cannot edit API-provisioned alert rules from the Grafana UI.

   In order to enable editing, add the x-disable-provenance header to the following requests when creating or editing your alert rules in the API:

   POST /api/v1/provisioning/alert-rules

   PUT /api/v1/provisioning/alert-rules/{UID}

1. Provision your alerting resources using Terraform.

**Note:**

Currently, provisioning for Grafana Alerting supports alert rules, contact points, mute timings, and templates. Provisioned alerting resources using file provisioning or Terraform can only be edited in the source that created them and not from within Grafana or any other source. For example, if you provision your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

**Useful Links:**

[Grafana provisioning](/docs/grafana/latest/administration/provisioning/)

[Grafana Cloud provisioning](/docs/grafana-cloud/infrastructure-as-code/terraform/)

[Grafana Alerting provisioning API](/docs/grafana/latest/developers/http_api/alerting_provisioning)
