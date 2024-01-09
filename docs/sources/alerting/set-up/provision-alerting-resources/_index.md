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
title: Provision Grafana Alerting resources
weight: 300
---

# Provision Grafana Alerting resources

Alerting infrastructure is often complex, with many pieces of the pipeline that often live in different places. Scaling this across multiple teams and organizations is an especially challenging task. Grafana Alerting provisioning makes this process easier by enabling you to create, manage, and maintain your alerting data in a way that best suits your organization.

Provisioning for Grafana Alerting supports alert rules, contact points, notification policies, mute timings, and templates.

You cannot edit provisioned alerting resources in the Grafana UI in the same way as unprovisioned alerting resources. You can only edit provisioned contact points, notification policies, templates, and mute timings in the source where they were created. For example, if you provision your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

To modify provisioned alert rules, you can use the **Modify export** feature to edit and then export.

Choose from the options below to provision your Grafana Alerting resources.

1. Use file provisioning to provision your Grafana Alerting resources, such as alert rules and contact points, through files on disk.

   {{% admonition type="note" %}}
   File provisioning is not available in Grafana Cloud instances.
   {{% /admonition %}}

2. Use the Alerting Provisioning HTTP API.

   For more information on the Alerting Provisioning HTTP API, refer to [Alerting provisioning HTTP API][alerting_provisioning].

3. Use [Terraform](https://www.terraform.io/).

**Useful Links:**

[Grafana provisioning][provisioning]

[Grafana Alerting provisioning API][alerting_provisioning]

{{% docs/reference %}}
[alerting_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api/alerting_provisioning"
[alerting_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api/alerting_provisioning"

[provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
[provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
{{% /docs/reference %}}
