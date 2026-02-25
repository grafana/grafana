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

{{include @grafana/snippets/plugin-install-verify.md}}

## Update the plugin

{{include @grafana/snippets/plugin-update.md}}

## Uninstall the plugin

{{include @grafana/snippets/plugin-uninstall.md}}

## Next steps

{{include @grafana/snippets/panel-next-steps.md}} # next steps different depending on plugin type

