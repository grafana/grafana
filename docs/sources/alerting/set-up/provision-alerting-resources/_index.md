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
title: Import and export alerting resources
weight: 300
---

# Import and export Grafana Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Importing and exporting (or provisioning) your alerting resources in Grafana Alerting makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

You can import alert rules, contact points, notification policies, mute timings, and templates.

You cannot edit imported alerting resources in the Grafana UI in the same way as alerting resources that were not imported. You can only edit imported contact points, notification policies, templates, and mute timings in the source where they were created. For example, if you manage your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

## Import alerting resouces

Choose from the options below to import (or provision) your Grafana Alerting resources.

1. [Use configuration files to provision and manage your alerting resources][alerting_file_provisioning], such as alert rules and contact points, through files on disk.

   {{% admonition type="note" %}}
   File provisioning is not available in Grafana Cloud instances.
   {{% /admonition %}}

2. Use the [Alerting provisioning HTTP API][alerting_http_provisioning].

3. Use [Terraform][alerting_tf_provisioning].

## Export alerting resources

You can export both manually created and provisioned alerting resources. For more information, refer to [Export alerting resources][alerting_export].

To modify imported alert rules, you can use the **Modify export** feature to edit and then export.

## View provisioned alerting resources

To view your provisioned resources in Grafana, complete the following steps.

1. Open your Grafana instance.
1. Navigate to Alerting.
1. Click an alerting resource folder, for example, Alert rules.

Provisioned resources are labeled **Provisioned**, so that it is clear that they were not created manually.

**Useful Links:**

[Grafana provisioning][provisioning]

{{% docs/reference %}}
[alerting_tf_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning"
[alerting_tf_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning"
[alerting_file_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning"
[alerting_file_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning"
[alerting_http_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning"
[alerting_http_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning"
[alerting_export]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/view-provisioned-resources"
[alerting_export]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/view-provisioned-resources"
[provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
[provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
{{% /docs/reference %}}
