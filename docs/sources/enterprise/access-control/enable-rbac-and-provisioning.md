---
title: 'Enable RBAC and provisioning in Grafana'
menuTitle: 'Enable RBAC and provisioning'
description: 'Learn how to enable RBAC and provisioning in Grafana.'
aliases: []
weight: 30
---

# Enable RBAC and provisioning

Before you assign RBAC roles to Grafana users and teams, you must enable it by:

- Adding a feature toggle to the Grafana configuration file, or
- Adding an environment variable to the Grafana configuration file

If you use provisioning to assign and manage roles, in addition to enabling RBAC, you must enable provisioning.

This topic includes instructions for both methods of enabling role-based access control, and steps for enabling provisioning.

## Enable RBAC

This section describes how to enable RBAC by setting a feature flag or adding an environment variable to the Grafana configuration file. You choose one method to enable RBAC. You are not required to use both methods to enable RBAC.

> **Note:** The environment variable overrides access control settings in the configuration file, if any exist.

**Before you begin:**

- Ensure that you have administration privileges to the Grafana server.

**To enable RBAC:**

1. Open the Grafana configuration file.

   For more information about the location of the Grafana configuration file, refer to [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}).

1. To enable RBAC using the feature toggle:

   a. Locate the `[feature toggles]` section in the configuration file.

   b. Add the following feature toggle parameter:

   ```
   [feature_toggles]
   # enable features, separated by spaces
   enable = accesscontrol
   ```

1. To enable RBAC by setting an environment variable, add the following environment variable to the configuration file:

   `GF_FEATURE_TOGGLES_ENABLE = accesscontrol`

   For more information about using environment variables in Grafana, refer to [Configuring with environment variables]({{< relref "../../administration/configuration.md#configure-with-environment-variables" >}}).

1. Save your changes and restart the Grafana server.

1. To verify that RBAC is enabled, send an HTTP request to the check endpoint.

   For more information about sending an HTTP request to the check endpoint, refer to [Check endpoint]({{< relref "../../http_api/access_control.md#check-if-enabled" >}}).

## Enable role provisioning

If you choose to use provisioning to assign and manage role, you must first enable it.

Grafana performs provisioning during startup. After you make a change to the configuration file, you can reload it during runtime. You do not need to restart the Grafana server for your changes to take effect.

**Before you begin:**

- Ensure that you have administration privileges to the Grafana server.

**To enable Grafana to provision custom roles:**

1. Sign in to the Grafana server.

1. Locate the Grafana configuration file.

1. Place the Grafana configuration file in the following location: **provisioning/access-control**.

1. Reload the provisioning configuration file.

   For more information about reloading the provisioning configuration at runtime, refer to [Reload provisioning configurations]({{< relref "../../http_api/admin/#reload-provisioning-configurations" >}}).
