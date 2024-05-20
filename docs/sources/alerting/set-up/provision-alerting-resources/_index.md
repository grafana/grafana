---
aliases:
  - ../provision-alerting-resources/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/
description: Import and export alerting resources
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import and export Grafana Alerting resources
weight: 300
refs:
  alerting_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/alerting_provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/alerting_provisioning/
  provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
---

# Import and export Grafana Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Importing and exporting (or provisioning) your alerting resources in Grafana Alerting makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

You can import alert rules, contact points, notification policies, mute timings, and templates.

You cannot edit imported alerting resources in the Grafana UI in the same way as alerting resources that were not imported. You can only edit imported contact points, notification policies, templates, and mute timings in the source where they were created. For example, if you manage your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

To modify imported alert rules, you can use the **Modify export** feature to edit and then export.

Choose from the options below to import your Grafana Alerting resources.

1. Use file provisioning to manage your Grafana Alerting resources, such as alert rules and contact points, through files on disk.

   {{% admonition type="note" %}}
   File provisioning is not available in Grafana Cloud instances.
   {{% /admonition %}}

2. Use the Alerting Provisioning HTTP API.

   For more information on the Alerting Provisioning HTTP API, refer to [Alerting provisioning HTTP API](ref:alerting_provisioning).

3. Use [Terraform](https://www.terraform.io/).

**Useful Links:**

[Grafana provisioning](ref:provisioning)

[Grafana Alerting provisioning API](ref:alerting_provisioning)

