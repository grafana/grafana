---
aliases:
  - unified-alerting/set-up/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/
description: How to configure alerting features and integrations
labels:
  products:
    - oss
menuTitle: Set up
title: Set up Alerting
weight: 107
---

# Set up Alerting

Set up or upgrade your implementation of Grafana Alerting.

**Note:**

These are set-up instructions for Grafana Alerting Open Source.

To set up Grafana Alerting for Cloud, see [Set up Alerting for Cloud][set-up-cloud].

## Before you begin

- Configure your [data sources][data-source-management]
- Check which data sources are compatible with and supported by [Grafana Alerting][data-source-alerting]

## Set up Alerting

To set up Alerting, you need to:

1. Configure alert rules

   - Create Grafana-managed or Mimir/Loki-managed alert rules and recording rules

1. Configure contact points

   - Check the default contact point and update the email address

   - [Optional] Add new contact points and integrations

1. Configure notification policies

   - Check the default notification policy

   - [Optional] Add additional nested policies

   - [Optional] Add labels and label matchers to control alert routing

1. [Optional] Integrate with [Grafana OnCall](/docs/oncall/latest/integrations/grafana-alerting)

## Advanced set up options

Grafana Alerting supports many additional configuration options, from configuring external Alertmanagers to routing Grafana-managed alerts outside of Grafana, to defining your alerting setup as code.

The following topics provide you with advanced configuration options for Grafana Alerting.

- [Provision alert rules using file provisioning][file-provisioning]
- [Provision alert rules using Terraform][terraform-provisioning]
- [Add an external Alertmanager][configure-alertmanager]
- [Configure high availability][configure-high-availability]

{{% docs/reference %}}
[configure-alertmanager]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/configure-alertmanager"
[configure-alertmanager]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager"

[configure-high-availability]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/configure-high-availability"
[configure-high-availability]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-high-availability"

[data-source-alerting]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/fundamentals/data-source-alerting"
[data-source-alerting]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/data-source-alerting"

[data-source-management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[data-source-management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[file-provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning"
[file-provisioning]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/file-provisioning"

[set-up-cloud]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/set-up-cloud"
[set-up-cloud]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/set-up-cloud"

[terraform-provisioning]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning"
[terraform-provisioning]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning"
{{% /docs/reference %}}
