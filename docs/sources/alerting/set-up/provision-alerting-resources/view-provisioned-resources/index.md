---
aliases:
  - ../../provision-alerting-resources/view-provisioned-resources/
description: View provisioned resources in Grafana
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
title: View provisioned alerting resources in Grafana
menuTitle: View provisioned resources in Grafana
weight: 300
---

# View provisioned alerting resources in Grafana

Verify that your alerting resources were created in Grafana.

To view your provisioned resources in Grafana, complete the following steps.

1. Open your Grafana instance.
1. Navigate to Alerting.
1. Click an alerting resource folder, for example, Alert rules.

Provisioned resources are labeled **Provisioned**, so that it is clear that they were not created manually.

**Note:**

You cannot edit provisioned resources from Grafana. You can only change the resource properties by changing the provisioning file and restarting Grafana or carrying out a hot reload. This prevents changes being made to the resource that would be overwritten if a file is provisioned again or a hot reload is carried out.
