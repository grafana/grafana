---
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
  alerting_export_http:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-api-endpoints
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-api-endpoints
  alerting_file_provisioning:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning/
  alerting_http_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/
  alerting_export:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/export-alerting-resources/
  alerting_tf_provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning/
  provisioning:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
---

# Provision Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Importing and exporting (or provisioning) your alerting resources in Grafana Alerting makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

You can import alert rules, contact points, notification policies, mute timings, and templates.

You cannot edit imported alerting resources in the Grafana UI in the same way as alerting resources that were not imported. You can only edit imported contact points, notification policies, templates, and mute timings in the source where they were created. For example, if you manage your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

## Import alerting resources

Choose from the options below to import (or provision) your Grafana Alerting resources.

1. [Use configuration files to provision your alerting resources](ref:alerting_file_provisioning), such as alert rules and contact points, through files on disk.

   {{< admonition type="note" >}}
   - You cannot edit provisioned resources from files in the Grafana UI.
   - Provisioning with configuration files is not available in Grafana Cloud.
     {{< /admonition >}}

1. Use [Terraform to provision alerting resources](ref:alerting_tf_provisioning).

1. Use the [Alerting provisioning HTTP API](ref:alerting_http_provisioning) to manage alerting resources.

   {{< admonition type="note" >}}

   The Alerting provisioning HTTP API can be used to create, modify, and delete resources for Grafana-managed alerts.

   To manage resources related to data source-managed alerts, including recording rules, use the Mimir or Cortex tool.

   The JSON output from the majority of Alerting HTTP endpoints isn't compatible for provisioning via configuration files.

   If you need the alerting resources for file provisioning, use [Export Alerting endpoints](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources#export-api-endpoints) to return or download them in provisioning format.
   {{< /admonition >}}

## Export alerting resources

You can export both manually created and provisioned alerting resources. You can also edit and export an alert rule without applying the changes.

For detailed instructions on the various export options, refer to [Export alerting resources](ref:alerting_export).

## View provisioned alerting resources

To view your provisioned resources in Grafana, complete the following steps.

1. Open your Grafana instance.
1. Navigate to Alerting.
1. Click an alerting resource folder, for example, Alert rules.

Provisioned resources are labeled **Provisioned**, so that it is clear that they were not created manually.
