---
title: 'Enable Grafana to provision custom roles'
menuTitle: 'Enable provisioning'
description: 'xxx.'
aliases: [xxx]
weight: 20
keywords:
  - xxx
---

# Enable Grafana to provision custom roles

Before you create or update custom roles, you must enable custom role provisioning in Grafana.

Grafana performs provisioning during startup. After you make a change to the configuration file, you can reload it during runtime. You do not need to restart the Grafana server for your changes to take effect.

## Before you begin

- Ensure that you have administration privileges to the Grafana server.

**To enable Grafana to provision custom roles:**

Not sure about these steps, making them up.

1. Sign in to the Grafana server.

1. Locate the Grafana configuration file.

1. Place the Grafana configuration file in the following location: **provisioning/access-control**.

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../../http_api/admin/#reload-provisioning-configurations" >}}).
