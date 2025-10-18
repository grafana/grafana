---
aliases:
  - ../../../auth/anonymous-auth/
description: Learn how to configure anonymous access in Grafana
labels:
  products:
    - enterprise
    - oss
menuTitle: Anonymous access
title: Configure anonymous access
weight: 250
---

# Anonymous authentication

You can make Grafana accessible without any login required by enabling anonymous access in the configuration file.

{{< admonition type="note" >}}
Anonymous users are charged as active users in Grafana Enterprise
{{< /admonition >}}

## Before you begin

To see the devices, you need:

- Permissions `users:read` which is normally only granted to server admins, that allow you to read users and devices tab.

## Anonymous devices

The anonymous devices feature enhances the management and monitoring of anonymous access within your Grafana instance. This feature is part of ongoing efforts to provide more control and transparency over anonymous usage.

Users can now view anonymous usage statistics, including the count of devices and users over the last 30 days.

- Go to **Administration -> Users** to access the anonymous devices tab.
- A new stat for the usage stats page -> Usage & Stats page shows the active anonymous devices last 30 days.

The number of anonymous devices is not limited by default. The configuration option `device_limit` allows you to enforce a limit on the number of anonymous devices. This enables you to have greater control over the usage within your Grafana instance and keep the usage within the limits of your environment. Once the limit is reached, any new devices that try to access Grafana will be denied access.

To display anonymous users and devices for versions 10.2, 10.3, 10.4, you need to enable the feature toggle `displayAnonymousStats`

```bash
[feature_toggles]
enable = displayAnonymousStats
```

## Configuration

Example:

```bash
[auth.anonymous]
enabled = true

# Organization name that should be used for unauthenticated users
org_name = Main Org.

# Role for unauthenticated users, other valid values are `Editor` and `Admin`
org_role = Viewer

# Hide the Grafana version text from the footer and help tooltip for unauthenticated users (default: false)
hide_version = true

# Setting this limits the number of anonymous devices in your instance. Any new anonymous devices added after the limit has been reached will be denied access.
device_limit =
```

If you change your organization name in the Grafana UI this setting needs to be updated to match the new name.
