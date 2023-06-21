---
menuTitle: Set up
aliases:
  - unified-alerting/set-up/
labels:
  products:
    - oss
description: How to configure alerting features and integrations
title: Set up Alerting
weight: 107
---

# Set up Alerting

Set up or upgrade your implementation of Grafana Alerting.

**Note:**

These are set-up instructions for Grafana Alerting Open Source.

To set up Grafana Alerting for Cloud, see [Set up Alerting for Cloud]({{< relref "../set-up/set-up-cloud" >}}).

## Before you begin

- Configure your [data sources]({{< relref "../../administration/data-source-management" >}})
- Check which data sources are compatible with and supported by [Grafana Alerting]({{< relref "../fundamentals/data-source-alerting" >}})

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

- [Provision alert rules using file provisioning]({{< relref "../set-up/provision-alerting-resources/file-provisioning" >}})
- [Provision alert rules using Terraform]({{< relref "../set-up/provision-alerting-resources/terraform-provisioning" >}})
- [Add an external Alertmanager]({{< relref "../set-up/configure-alertmanager" >}})
- [Configure high availability]({{< relref "../set-up/configure-high-availability" >}})
