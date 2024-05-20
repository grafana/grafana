---
aliases:
  - ../provision-alerting-resources/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/
description: Provision alerting resources
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
title: Provision Alerting resources
weight: 300
refs:
  alerting_tf_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
  alerting_export:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/
  provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
  alerting_export_http:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-api-endpoints
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-api-endpoints
  alerting_http_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/
---

# Provision Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Importing and exporting (or provisioning) your alerting resources in Grafana Alerting makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

You can import alert rules, contact points, notification policies, mute timings, and templates.

You cannot edit imported alerting resources in the Grafana UI in the same way as alerting resources that were not imported. You can only edit imported contact points, notification policies, templates, and mute timings in the source where they were created. For example, if you manage your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

## Import alerting resources

Choose from the options below to import (or provision) your Grafana Alerting resources.

1. [Use configuration files to provision your alerting resources](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning), such as alert rules and contact points, through files on disk.

   {{< admonition type="note" >}}
   File provisioning is not available in Grafana Cloud instances.
   {{< /admonition >}}

1. Use [Terraform to provision alerting resources](ref:alerting_tf_provisioning).

1. Use the [Alerting provisioning HTTP API](ref:alerting_http_provisioning) to manage alerting resources.

   {{< admonition type="note" >}}
   The JSON output from the majority of Alerting HTTP endpoints isn't compatible for provisioning via configuration files.
   Instead, use the [Export Alerting endpoints](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources#export-api-endpoints) to return or download the alerting resources in provisioning format.
   {{< /admonition >}}

## Export alerting resources

You can export both manually created and provisioned alerting resources. For more information, refer to [Export alerting resources](ref:alerting_export).

To modify imported alert rules, you can use the **Modify export** feature to edit and then export.

## View provisioned alerting resources

To view your provisioned resources in Grafana, complete the following steps.

1. Open your Grafana instance.
1. Navigate to Alerting.
1. Click an alerting resource folder, for example, Alert rules.

Provisioned resources are labeled **Provisioned**, so that it is clear that they were not created manually.

**Useful Links:**

[Grafana provisioning](ref:provisioning)

