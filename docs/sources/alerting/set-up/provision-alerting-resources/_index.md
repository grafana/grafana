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

There are three options to choose from:

1. Use file provisioning to provision your Grafana Alerting resources, such as alert rules and contact points, through files on disk.

1. Provision your alerting resources using the Alerting Provisioning HTTP API.

   For more information on the Alerting Provisioning HTTP API, refer to [Alerting provisioning API]({{< relref "../../../developers/http_api/alerting_provisioning" >}}).

1. Provision your alerting resources using [Terraform](https://www.terraform.io/).

**Note:**

Currently, provisioning for Grafana Alerting supports alert rules, contact points, notification policies, mute timings, and templates. Provisioned alerting resources using file provisioning or Terraform can only be edited in the source that created them and not from within Grafana or any other source. For example, if you provision your alerting resources using files from disk, you cannot edit the data in Terraform or from within Grafana.

**Useful Links:**

[Grafana provisioning][provisioning]

[Terraform provisioning](/docs/grafana-cloud/infrastructure-as-code/terraform/)

[Grafana Alerting provisioning API][alerting_provisioning]

{{% docs/reference %}}
[alerting_provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api/alerting_provisioning"
[alerting_provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api/alerting_provisioning"

[provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
[provisioning]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning"
{{% /docs/reference %}}
