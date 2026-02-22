# Installation

This guide explains how to install [plugin name] in Grafana.

## Prerequisites

Before you install [plugin name], ensure you have:

- Grafana version [minimum version] or later
- Appropriate permissions to install plugins
- [Any other prerequisites]

## Installation methods

You can install [plugin name] using one of the following methods:

- [Grafana UI](#install-using-grafana-ui)
- [Grafana CLI](#install-using-grafana-cli)
- [Docker](#install-using-docker)
- [Manual installation](#manual-installation)

### Install using Grafana UI

To install the plugin using the Grafana UI:

1. Sign in to Grafana.
1. Navigate to **Administration > Plugins and data > Plugins**.
1. Search for "[plugin name]".
1. Click the plugin to open the plugin details page.
1. Click **Install**.

After installation, restart Grafana if required.

### Install using Grafana CLI

To install the plugin using the Grafana CLI:

1. Run the following command:

   ```sh
   grafana cli plugins install [plugin-id]
   ```

1. Restart Grafana:

   ```sh
   sudo systemctl restart grafana-server
   ```

### Install using Docker

To install the plugin in a Docker container, add the following environment variable to your `docker run` command:

```sh
docker run -d \
  -p 3000:3000 \
  -e "GF_INSTALL_PLUGINS=[plugin-id]" \
  --name=grafana \
  grafana/grafana
```

Alternatively, if you're using Docker Compose, add the environment variable to your `docker-compose.yml` file:

```yaml
version: '3'
services:
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_INSTALL_PLUGINS=[plugin-id]
```

### Manual installation

To install the plugin manually:

1. Download the plugin from the [releases page](https://github.com/org/plugin-name/releases).
1. Extract the archive into your Grafana plugins directory:
   - Default Linux path: `/var/lib/grafana/plugins`
   - Default Windows path: `C:\Program Files\GrafanaLabs\grafana\data\plugins`
   - Default macOS path: `/usr/local/var/lib/grafana/plugins`
1. Restart Grafana.

## Verify installation

To verify the plugin installed successfully:

1. Navigate to **Administration > Plugins and data > Plugins**.
1. Search for "[plugin name]".
1. Confirm the plugin appears in the list with an **Installed** badge.

You can also check the Grafana logs:

```sh
grep "Plugin registered" /var/log/grafana/grafana.log | grep [plugin-id]
```

## Update the plugin

To update the plugin to the latest version, use the same installation method you used initially.

For Grafana CLI:

```sh
grafana cli plugins update [plugin-id]
sudo systemctl restart grafana-server
```

## Uninstall the plugin

To uninstall the plugin:

### Using Grafana CLI

```sh
grafana cli plugins remove [plugin-id]
sudo systemctl restart grafana-server
```

### Manual uninstallation

1. Remove the plugin directory from your Grafana plugins directory.
1. Restart Grafana.

## Next steps

- [Configure the plugin](CONFIGURATION.md)
- [Learn about data requirements](DATA-REQUIREMENTS.md)
- [View the quick start guide](README.md#quick-start)
