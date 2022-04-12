---
title: 'Enable role-based access control in Grafana'
menuTitle: 'Enable role-based access control control'
description: 'xxx.'
aliases: [xxx]
weight: 30
keywords:
  - xxx
---

# Enable role-based access control

Before you assign fine-grained access control to Grafana users, you must enable it.

You can enable fine-grained access control by:

- adding a feature toggle to the Grafana configuration file, or
- adding an environment variable to the Grafana configuration file

This topic includes instructions for both methods of enabling fine-grained access control, and steps for how to verify that it is enabled.

## Before you begin

- Ensure that you have administration privileges to the Grafana server.

**To enable fine-grained access control in the Grafana configuration file**:

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

1. To verify that it is enabled, refer to [verify that fine-grained access control is enabled](#verify-that-fine-grained-access control-is-enabled).
   <br/>

**To enable fine-grained access control using an environment variable:**

1. Open the Grafana configuration file.

   For more information about the location of the Grafana configuration file, refer to [config file]({{< relref "../../administration/configuration.md#config-file-locations" >}}).

1. Add the following environment variable to the configuration file:

   `GF_FEATURE_TOGGLES_ENABLE = accesscontrol`

   This environment variable overrides access control settings in the configuration file, if any exist.

   For more information about using environment variables in Grafana, refer to [Configuring with environment variables]({{< relref "../../administration/configuration.md#configure-with-environment-variables" >}}).

1. Save your changes and restart the Grafana server.

1. To verify that it is enabled, refer to [verify that fine-grained access control is enabled](#verify-that-fine-grained-access control-is-enabled).

## Verify that fine-grained access control is enabled

To verify that fine-grained access control is enabled, send an HTTP request to the check endpoint.

For more information about sending an HTTP request to the check endpoint, refer to [Check endpoint]({{< relref "../../http_api/access_control.md#check-if-enabled" >}}).

## Limitation

If you have created a folder with the name `General` or `general`, you cannot manage its permissions with RBAC.

If you set [folder permissions]({{< relref "../../administration/manage-users-and-permissions/manage-dashboard-permissions/_index.md" >}}) for a folder named `General` or `general`, the system disregards the folder when RBAC is enabled.
