---
aliases:
  - ../../parca/
description: Configure the Parca data source in Grafana to connect to your Parca
  continuous profiling instance.
keywords:
  - grafana
  - parca
  - configure
  - install
  - profiling
  - data source
labels:
  products:
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Parca data source
weight: 200
review_date: 2026-10-08
---

# Configure the Parca data source

{{< admonition type="warning" >}}
This plugin is deprecated and will only receive critical security updates. Support will end on January 2, 2027.
{{< /admonition >}}

This document explains how to install and configure the Parca data source in Grafana.

To use the Parca data source, you must build it from source and install it into your local Grafana plugin directory. After it's installed, you can configure the data source using the Grafana UI, a YAML provisioning file, or Terraform.
If you make any changes in the UI, select **Save & test** to preserve those changes.

## Before you begin

Before you install the Parca data source, ensure you have:

- **Grafana:** A self-managed Grafana instance, version 13.2 or later. The Parca data source isn't available in Grafana Cloud.
- **Server access:** Shell access to the host running Grafana, with permission to write to the plugin directory and restart Grafana.
- **Grafana permissions:** `Organization administrator` role to add and configure the data source.
- **Parca instance:** A running Parca instance (v0.19 or later) accessible from your Grafana server.
- **Build tools:** Node.js 24 or later, npm 11.12.1 or later, and Go 1.26.5 or later. These are the versions the repository currently requires. Refer to `.nvmrc`, the `engines` field in `package.json`, and `go.mod` in the [data source repository](https://github.com/grafana/grafana-parca-datasource) for the authoritative versions.

## Install the data source

The Parca data source has both a frontend and a Go backend, so you must build both and then copy the result into your Grafana plugin directory.

### Build the data source from source

Clone the repository and build the frontend and backend:

```sh
git clone https://github.com/grafana/grafana-parca-datasource.git
cd grafana-parca-datasource
npm ci
npm run build
go run github.com/magefile/mage -v buildAll
```

Both build commands are required. `npm run build` produces the frontend assets, and the `mage buildAll` target compiles the backend executables for each supported platform. Running only `npm run build` produces a data source that Grafana loads but can't query, because the backend executable is missing.

Both commands write their output to the `dist/` directory.

### Deploy the data source to Grafana

Copy the contents of `dist/` into a `parca` directory inside your Grafana plugin directory. On a package-based Linux installation, the plugin directory is `/var/lib/grafana/plugins`:

```sh
sudo mkdir -p /var/lib/grafana/plugins/parca
sudo cp -a dist/. /var/lib/grafana/plugins/parca/
sudo chown -R grafana:grafana /var/lib/grafana/plugins/parca
```

The Grafana process must be able to read every file in the directory and execute the backend binary.

If you run Grafana in Docker, mount the `dist/` directory at `/var/lib/grafana/plugins/parca` instead:

```sh
docker run -d \
  -v "$(pwd)/dist:/var/lib/grafana/plugins/parca" \
  -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=parca \
  -p 3000:3000 \
  grafana/grafana:latest
```

The plugin directory path is set by the `plugins` configuration option. If you've changed it, use your configured path instead. For more information, refer to [Configure Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#plugins).

### Allow the unsigned plugin

A data source you build yourself isn't signed, and Grafana refuses to load unsigned plugins by default. Add the `parca` plugin ID to the `allow_loading_unsigned_plugins` option in your Grafana configuration file, typically `/etc/grafana/grafana.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = parca
```

Restart Grafana to load the data source:

```sh
sudo systemctl restart grafana-server
```

When Grafana loads an unsigned plugin, it writes a warning to the server log:

```text
WARN[...] Permitting unsigned plugin. This is not recommended   pluginId=parca
```

For more information, refer to [Plugin signatures](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/plugin-sign/) and the [`allow_loading_unsigned_plugins` option](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#allow_loading_unsigned_plugins).

### Verify the data source loaded

To confirm Grafana loaded the Parca data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Parca` in the search bar.

If **Parca** doesn't appear, check the Grafana server log for plugin loading errors. Refer to [Troubleshoot Parca data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/troubleshooting/#installation-issues).

### Migrate from the bundled data source

Grafana 13.1 and earlier bundled the Parca data source. If you're upgrading from one of those versions and you already have Parca data sources configured, install it as described in the preceding sections before you upgrade Grafana. The plugin ID is still `parca`, so your existing data sources continue to work once Grafana can load it.

{{< admonition type="caution" >}}
Don't delete and recreate your existing Parca data sources. Dashboards and alert rules reference data sources by UID, so a new UID breaks those references. Keep the existing data source and its UID.
{{< /admonition >}}

If you upgrade Grafana before you install the data source, your existing Parca data sources and any panels that query them report the `parca` plugin isn't found. Installing it and restarting Grafana resolves this without any change to your data sources.

## Add the data source

After the data source is installed, add it in Grafana:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Parca` in the search bar.
1. Select **Parca**.
1. Click **Add new data source**.

## Configure settings

The **Settings** tab contains the following configuration sections.

### Basic settings

| Setting     | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| **Name**    | A name to identify this data source in panels, queries, and Explore. |
| **Default** | Toggle to make this the default data source for new panels.          |

### Connection

| Setting | Description                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL** | The URL of your Parca instance. For example, `http://localhost:7070`. Grafana connects to Parca using gRPC-Web, so the URL should point to the Parca HTTP endpoint. |

### Authentication

Use this section to select an authentication method to access the data source. The available methods are:

| Method                     | Description                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Basic authentication**   | Authenticate with a username and password. Enter values in the **User** and **Password** fields. |
| **Forward OAuth Identity** | Forward the logged-in user's OAuth token to the data source.                                     |
| **No Authentication**      | Connect without credentials. Use this when the Parca instance doesn't require authentication.    |

### TLS settings

Configure TLS for secure communication with your Parca instance.

| Setting                             | Description                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Add self-signed certificate**     | Toggle to provide a CA certificate. When enabled, paste the CA certificate in the **CA Certificate** field.         |
| **TLS Client Authentication**       | Toggle to enable mutual TLS. When enabled, provide the **Server Name**, **Client Certificate**, and **Client Key**. |
| **Skip TLS certificate validation** | Toggle to skip server certificate verification. Use only for testing.                                               |

{{< admonition type="note" >}}
Use Transport Layer Security (TLS) for an additional layer of security when working with Parca.
{{< /admonition >}}

### Custom HTTP headers

Add custom HTTP headers to requests sent to the Parca instance. Click **Add header** to add a new row with **Header** (name) and **Value** (secret) fields.

Custom headers are useful for passing authentication tokens or routing information required by proxies between Grafana and Parca.

## Additional settings

Click the down arrow to expand the **Additional settings** section. These settings are optional.

### Advanced HTTP settings

| Setting             | Description                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Allowed cookies** | Cookies that should be forwarded to the data source. The Grafana proxy strips all cookies by default. |
| **Timeout**         | The HTTP request timeout in seconds.                                                                  |

### Secure SOCKS proxy

{{< admonition type="note" >}}
This section is only visible when the Grafana server has the secure SOCKS proxy feature enabled.
{{< /admonition >}}

| Setting     | Description                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| **Enabled** | Toggle to route requests to the Parca instance through a secure SOCKS proxy. |

## Verify the connection

Click **Save & test** to verify that Grafana can connect to your Parca instance. The health check queries the available profile types from the Parca server. A successful connection displays the message

**Data source is working**.

If the test fails, verify that the URL is correct and that your Parca instance is running and accessible from the Grafana server. For more help, refer to [Troubleshoot Parca data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/troubleshooting/).

## Provision the data source

You can define the data source in YAML files as part of the Grafana provisioning system.
For more information, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

Provisioning doesn't install the data source. Install it first, as described in [Install the data source](#install-the-data-source), or Grafana fails to provision it because the `parca` plugin ID isn't registered.

### YAML provisioning example

Create a file such as `/etc/grafana/provisioning/datasources/parca.yaml` and restart Grafana:

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    uid: parca
    access: proxy
    url: http://localhost:7070
```

Set `url` to an address the Grafana server can reach. If Grafana and Parca run in separate containers, `localhost` resolves to the Grafana container, so use the Parca service name instead, for example `http://parca:7070`.

Set `uid` explicitly so dashboards can reference the data source by a stable UID. If you're replacing an existing Parca data source, use its current UID.

To provision with basic authentication:

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    uid: parca
    access: proxy
    url: http://localhost:7070
    basicAuth: true
    basicAuthUser: <USERNAME>
    secureJsonData:
      basicAuthPassword: <PASSWORD>
```

Replace the following:

- `<USERNAME>`: Your Parca username.
- `<PASSWORD>`: Your Parca password.

### Terraform example

To provision the data source with Terraform, use the [`grafana_data_source` resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source):

```hcl
resource "grafana_data_source" "parca" {
  type = "parca"
  name = "Parca"
  uid  = "parca"
  url  = "http://localhost:7070"
}
```

To provision with basic authentication:

```hcl
resource "grafana_data_source" "parca" {
  type                = "parca"
  name                = "Parca"
  uid                 = "parca"
  url                 = "http://localhost:7070"
  basic_auth_enabled  = true
  basic_auth_username = "<USERNAME>"

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = "<PASSWORD>"
  })
}
```

Replace the following:

- `<USERNAME>`: Your Parca username.
- `<PASSWORD>`: Your Parca password.

## Next steps

- [Query profiling data with the Parca query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/query-editor/)
