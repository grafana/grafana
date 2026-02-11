# Install [Plugin Name]

This guide shows you how to install [Plugin Name] in Grafana.

## Prerequisites

Before you begin, ensure you have the following:

- Grafana version X.X.X or later
- [Operating system requirements if any]
- [Any external dependencies or services]
- [Required credentials or API keys]

## Installation methods

Choose one of the following installation methods:

- [Install from Grafana UI](#install-from-grafana-ui) (recommended)
- [Install with Grafana CLI](#install-with-grafana-cli)
- [Install from ZIP file](#install-from-zip-file)
- [Install from source](#install-from-source)

## Install from Grafana UI

To install [Plugin Name] from the Grafana UI:

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side menu.
2. In the search box, enter "[Plugin Name]".
3. Click the plugin logo.
4. Click **Install**.

When installation completes, a confirmation message indicates the installation was successful.

## Install with Grafana CLI

To install [Plugin Name] using the Grafana CLI:

1. Run the following command:

```bash
grafana-cli plugins install [your-plugin-id]
```

2. Restart Grafana:

**On Linux with systemd:**

```bash
sudo systemctl restart grafana-server
```

**On Linux with init.d:**

```bash
sudo service grafana-server restart
```

**On macOS:**

```bash
brew services restart grafana
```

**On Windows:**

Restart the Grafana service from the Windows Services console.

## Install from ZIP file

To install [Plugin Name] from a ZIP file:

1. Download the latest release from the [GitHub releases page](https://github.com/[your-username]/[your-plugin-repo]/releases).

2. Extract the ZIP file into your Grafana plugins directory:

**Default plugin directories:**

- **Linux**: `/var/lib/grafana/plugins`
- **macOS**: `/usr/local/var/lib/grafana/plugins`
- **Windows**: `C:\Program Files\GrafanaLabs\grafana\data\plugins`

**Using custom plugin directory:**

If you configured a custom plugin directory in `grafana.ini`, extract the ZIP file there.

3. Restart Grafana (refer to the commands in the CLI section above).

## Install from source

To install [Plugin Name] from source:

1. Clone the repository:

```bash
cd /var/lib/grafana/plugins
git clone https://github.com/[your-username]/[your-plugin-repo]
cd [your-plugin-repo]
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Build the plugin:

```bash
npm run build
# or
yarn build
```

4. Restart Grafana.

## Verify installation

To verify [Plugin Name] installed successfully:

1. Navigate to **Administration > Plugins and data > Plugins**.
2. In the search box, enter "[Plugin Name]".
3. Confirm the plugin appears with an "Installed" label.

Alternatively, check the Grafana logs for a successful plugin registration message:

```
INFO[01-01|12:00:00] Plugin registered       logger=plugin.loader pluginID=[your-plugin-id]
```

## Configuration

After installation, configure [Plugin Name]:

- For data source plugins, refer to [Configure data source](configuration.md)
- For panel plugins, add a panel to a dashboard and configure visualization options
- For app plugins, refer to [Configure app plugin](configuration.md)

## Troubleshooting

### Plugin not appearing in Grafana

If the plugin doesn't appear after installation:

1. Verify the plugin files are in the correct directory
2. Check that the `plugin.json` file exists in the plugin directory
3. Review Grafana logs for error messages:

```bash
tail -f /var/log/grafana/grafana.log
```

4. Ensure Grafana has read permissions for the plugin directory
5. Verify the plugin is compatible with your Grafana version

### Unsigned plugin warning

If you see an unsigned plugin warning:

1. For development, add the plugin to the allow list in `grafana.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = [your-plugin-id]
```

2. For production, refer to [Plugin signature verification](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-signature-verification/).

### Permission denied errors

If you encounter permission errors:

1. Ensure the Grafana user has read permissions for the plugin directory:

```bash
sudo chown -R grafana:grafana /var/lib/grafana/plugins/[your-plugin-directory]
```

2. Restart Grafana after fixing permissions.

## Update the plugin

To update [Plugin Name] to the latest version:

1. Navigate to **Administration > Plugins and data > Plugins**.
2. Click the **Installed** filter.
3. Click the [Plugin Name] logo.
4. Click **Update**.

Alternatively, update using the Grafana CLI:

```bash
grafana-cli plugins update [your-plugin-id]
```

Restart Grafana after updating.

## Uninstall the plugin

To uninstall [Plugin Name]:

### From Grafana UI

1. Navigate to **Administration > Plugins and data > Plugins**.
2. Click the [Plugin Name] logo.
3. Click **Uninstall**.

### With Grafana CLI

```bash
grafana-cli plugins remove [your-plugin-id]
```

Restart Grafana after uninstalling.

## Next steps

- [Configure the plugin](configuration.md)
- [Quick start guide](quick-start.md)
- [Query syntax reference](query-syntax.md)
