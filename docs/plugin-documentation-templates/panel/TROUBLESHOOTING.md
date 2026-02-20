# Troubleshooting

This guide helps you troubleshoot common issues with [plugin name].

## Plugin not appearing in Grafana

### Issue

The plugin doesn't appear in the plugins list or visualization picker.

### Solutions

1. Verify the plugin is installed:

   ```sh
   grafana cli plugins ls
   ```

   The plugin should appear in the list.

1. Check the Grafana logs for errors:

   ```sh
   grep "Plugin registered" /var/log/grafana/grafana.log | grep [plugin-id]
   ```

1. Verify the plugin directory exists:

   - Linux: `/var/lib/grafana/plugins/[plugin-id]`
   - Windows: `C:\Program Files\GrafanaLabs\grafana\data\plugins\[plugin-id]`
   - macOS: `/usr/local/var/lib/grafana/plugins/[plugin-id]`

1. Restart Grafana:

   ```sh
   sudo systemctl restart grafana-server
   ```

1. Check plugin permissions. The Grafana user must have read access to the plugin directory.

## Plugin fails to load

### Issue

The plugin appears in the plugins list but fails to load or shows an error.

### Solutions

1. Check the browser console for JavaScript errors.

1. Verify the plugin version is compatible with your Grafana version.

1. Check if the plugin is signed. Unsigned plugins require configuration:

   ```ini
   [plugins]
   allow_loading_unsigned_plugins = [plugin-id]
   ```

1. Clear the browser cache and reload Grafana.

1. Verify the plugin's `module.js` file exists in the plugin directory.

## No data displayed

### Issue

The panel is added but shows no data or displays "No data" message.

### Solutions

1. Verify your query returns data:
   - Open the Query Inspector by clicking the panel title > **Inspect** > **Query**.
   - Check if the data source query returns results.

1. Verify the data format matches the plugin requirements:
   - Refer to [Data requirements](DATA-REQUIREMENTS.md).
   - Ensure required fields are present in the query results.

1. Check the time range:
   - Verify the dashboard time range includes data.
   - Try expanding the time range.

1. Verify the data source is configured correctly and accessible.

1. Check for query errors in the Query Inspector.

## Incorrect data visualization

### Issue

The panel displays data but the visualization is incorrect or unexpected.

### Solutions

1. Verify the data format:
   - Check the Query Inspector to see the actual data structure.
   - Ensure the data matches the expected format in [Data requirements](DATA-REQUIREMENTS.md).

1. Check panel configuration:
   - Review all panel options in the panel editor.
   - Verify field mappings and overrides.

1. Check for data transformations:
   - Review any applied transformations.
   - Disable transformations to see the raw data.

1. Verify field types:
   - Ensure numeric fields are detected as numbers, not strings.
   - Use transformations to convert field types if needed.

## Performance issues

### Issue

The panel is slow to load or causes browser performance problems.

### Solutions

1. Reduce the amount of data:
   - Limit the query to return fewer data points.
   - Use aggregations to summarize data.
   - Reduce the time range.

1. Optimize the query:
   - Add appropriate filters to the query.
   - Use indexes on the data source.
   - Avoid expensive calculations.

1. Check browser console for warnings or errors.

1. Disable debug mode in panel options if enabled.

1. Update to the latest plugin version.

## Configuration options not working

### Issue

Changes to panel options don't affect the visualization.

### Solutions

1. Click **Apply** after making changes in the panel editor.

1. Refresh the panel:
   - Use the panel menu > **Refresh**.
   - Or refresh the entire dashboard.

1. Check for console errors in the browser developer tools.

1. Verify the option is supported in your plugin version.

1. Clear the browser cache and reload Grafana.

## Plugin compatibility issues

### Issue

The plugin doesn't work after upgrading Grafana.

### Solutions

1. Check the plugin's compatibility with your Grafana version:
   - Review the plugin's release notes.
   - Check the `dependencies` section in `plugin.json`.

1. Update the plugin to the latest version:

   ```sh
   grafana cli plugins update [plugin-id]
   sudo systemctl restart grafana-server
   ```

1. Check for breaking changes in the plugin's [CHANGELOG.md](CHANGELOG.md).

1. Review Grafana's breaking changes documentation for your version.

## Browser compatibility issues

### Issue

The plugin doesn't work correctly in certain browsers.

### Solutions

1. Use a supported browser:
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Edge (latest)

1. Disable browser extensions that might interfere with Grafana.

1. Check the browser console for errors.

1. Clear the browser cache and cookies.

## Data source connection issues

### Issue

The panel can't connect to the data source.

### Solutions

1. Verify the data source is configured and working:
   - Navigate to **Configuration** > **Data sources**.
   - Click the data source and click **Save & test**.

1. Check data source permissions:
   - Ensure you have permission to access the data source.
   - Verify the data source credentials are correct.

1. Check network connectivity:
   - Ensure the data source is accessible from the Grafana server.
   - Check firewall rules and network policies.

1. Review data source logs for errors.

## Error messages

### "Plugin not found"

**Cause**: The plugin is not installed or the plugin ID is incorrect.

**Solution**: Install the plugin using the correct plugin ID and restart Grafana.

### "Failed to load plugin"

**Cause**: The plugin files are corrupted or incompatible.

**Solution**: Reinstall the plugin:

```sh
grafana cli plugins remove [plugin-id]
grafana cli plugins install [plugin-id]
sudo systemctl restart grafana-server
```

### "Unsigned plugin"

**Cause**: Grafana requires plugins to be signed.

**Solution**: Configure Grafana to allow unsigned plugins:

```ini
[plugins]
allow_loading_unsigned_plugins = [plugin-id]
```

### "Query error"

**Cause**: The data source query has errors.

**Solution**: 
- Check the query syntax.
- Verify the data source is accessible.
- Review the Query Inspector for detailed error messages.

## Get help

If you continue experiencing issues:

1. Check the [FAQ](#faq) section below.
1. Search for similar issues in the [GitHub repository](https://github.com/org/plugin-name/issues).
1. Review the [documentation](README.md).
1. Ask for help in the [Grafana Community Forums](https://community.grafana.com/c/plugin-development/30).
1. Report a bug on [GitHub](https://github.com/org/plugin-name/issues/new).

When reporting an issue, include:

- Grafana version
- Plugin version
- Browser and version
- Steps to reproduce the issue
- Error messages from the browser console
- Screenshots if applicable

## FAQ

### Can I use this plugin with Grafana Cloud?

[Answer about Grafana Cloud compatibility]

### Does this plugin work with all data sources?

[Answer about data source compatibility]

### How do I update the plugin?

Refer to the [Installation guide](INSTALLATION.md#update-the-plugin).

### Is there a demo or example dashboard?

[Information about demos or examples]

### Can I customize the visualization?

[Information about customization options]

## Debug mode

To enable debug mode for troubleshooting:

1. [Instructions to enable debug mode if applicable]
1. Check the browser console for detailed debug messages.
1. [Additional debug instructions]

## Known issues

Refer to the [GitHub Issues](https://github.com/org/plugin-name/issues) page for known issues and workarounds.

## Next steps

- [Review configuration options](CONFIGURATION.md)
- [Check data requirements](DATA-REQUIREMENTS.md)
- [View development guide](DEVELOPMENT.md)
