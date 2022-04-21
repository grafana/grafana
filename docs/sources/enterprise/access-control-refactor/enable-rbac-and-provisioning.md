---
title: 'Enable role-based access control in Grafana'
menuTitle: 'Enable RBAC'
description: 'xxx.'
aliases: [xxx]
weight: 30
keywords:
  - xxx
---

# Enable role-based access control

Before you assign role-based access control to Grafana users, you must enable it.

You can enable role-based access control by:

- adding a feature toggle to the Grafana configuration file, or
- adding an environment variable to the Grafana configuration file

This topic includes instructions for both methods of enabling role-based access control, and steps for how to verify that it is enabled.

## Before you begin

- Ensure that you have administration privileges to the Grafana server.

**To enable role-based access control in the Grafana configuration file:**

1. Open the Grafana configuration file.

   For more information about the location of the Grafana configuration file, refer to [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}).

1. Locate the `[feature toggles]` section in the configuration file.

1. Add the following enable parameter:

   ```
   [feature_toggles]
   # enable features, separated by spaces
   enable = accesscontrol
   ```

1. Save your changes and restart the Grafana server.

1. To verify that it is enabled, refer to [verify that role-based access control is enabled](#verify-that-role-based-access-control-is-enabled).
   <br/>

**To enable role-based access control using an environment variable:**

1. Open the Grafana configuration file.

   For more information about the location of the Grafana configuration file, refer to [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}).

1. Add the following environment variable to the configuration file:

   `GF_FEATURE_TOGGLES_ENABLE = accesscontrol`

   This environment variable overrides access control settings in the configuration file, if any exist.

   For more information about using environment variables in Grafana, refer to [Configuring with environment variables]({{< relref "../../administration/configuration.md#configure-with-environment-variables" >}}).

1. Save your changes and restart the Grafana server.

1. To verify that it is enabled, refer to [verify that role-based access control is enabled](#verify-that-role-based-access-control-is-enabled).

## Verify that role-based access control is enabled

To verify that role-based access control is enabled, send an HTTP request to the check endpoint.

For more information about sending an HTTP request to the check endpoint, refer to [Check endpoint]({{< relref "../../http_api/access_control.md#check-if-enabled" >}}).

## Limitation

If you have created a folder with the name `General` or `general`, you cannot manage its permissions with RBAC.

If you set [folder permissions]({{< relref "../../administration/manage-users-and-permissions/manage-dashboard-permissions/_index.md" >}}) for a folder named `General` or `general`, the system disregards the folder when RBAC is enabled.

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
