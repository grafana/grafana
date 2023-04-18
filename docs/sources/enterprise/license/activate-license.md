---
aliases:
  - ../activate-license/
description: Activate an Enterprise license
keywords:
  - grafana
  - licensing
  - enterprise
title: Activate an Enterprise license
weight: 100
---

# Activate an Enterprise license

Follow these steps to activate your Grafana Enterprise license:

## Step 1. Download your license file

To download your Grafana Enterprise license:

1. Sign in to your [Grafana Cloud](https://grafana.com) account.
1. Go to **My Account** and select an organization from the drop-down menu at the top left of the page. On the Overview page for each organization, you can see a section for Grafana Enterprise licenses. Click **Details** next to a license.
1. At the bottom of the license details page, select **Download token** to download the `license.jwt` file that contains your license.

## Step 2. Add your license to a Grafana instance

There is more than one way to add the license to a Grafana instance:

### Upload the license file via the Grafana server administrator page

This is the preferred option for single instance installations of Grafana Enterprise.

1. Sign in as a Grafana server administrator.
1. Navigate to **Server Admin > Upgrade** within Grafana.
1. Click **Upload license token file**.
1. Select your license file, and upload it.

### Put the `license.jwt` file into the data directory of Grafana

On Linux systems, the data directory is usually at `/var/lib/grafana`.

You can also configure a custom location for the license file using the grafana.ini setting:

```bash
[enterprise]
license_path = /company/secrets/license.jwt
```

This setting can also be set with an environment variable, which is useful if you're running Grafana with Docker and have a custom volume where you have placed the license file. In this case, set the environment variable `GF_ENTERPRISE_LICENSE_PATH` to point to the location of your license file.

### Set the content of the license file as a configuration option

You can add a license by pasting the content of the `license.jwt`
to the grafana.ini configuration file:

```bash
[enterprise]
license_text = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aGlzIjoiaXMiLCJub3QiOiJhIiwidmFsaWQiOiJsaWNlbnNlIn0.bxDzxIoJlYMwiEYKYT_l2s42z0Y30tY-6KKoyz9RuLE
```

This option can be set using the `GF_ENTERPRISE_LICENSE_TEXT`
environment variable.

## Step 3. Ensure that the license file's root URL matches the root_url configuration option

Update the [`root_url`]({{< relref "../../administration/configuration/#root-url" >}}) in your configuration. It should be the URL that users type in their browsers to access the frontend, not the node hostname(s).

This is important, because as part of the validation checks at startup, Grafana compares the license URL to the [`root_url`]({{< relref "../../administration/configuration/#root-url" >}}) in your configuration.

In your configuration file:

```
[server]
root_url = https://grafana.example.com/
```

Or with an environment variable:

```
GF_SERVER_ROOT_URL=https://grafana.example.com/
```

## Step 4. Restart Grafana

To finalize the installation of Grafana Enterprise, restart Grafana to enable all Grafana Enterprise features. Refer to [restart Grafana]({{< relref "../../installation/restart-grafana.md" >}}) for more information.
