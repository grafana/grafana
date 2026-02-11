# Troubleshooting [Plugin Name]

This guide helps you resolve common issues with [Plugin Name].

## General troubleshooting steps

Before diving into specific issues, try these general troubleshooting steps:

1. Check the Grafana logs for error messages
2. Verify the plugin version is compatible with your Grafana version
3. Ensure the plugin is installed and enabled
4. Test the data source connection
5. Review the browser console for JavaScript errors

## View logs

To view Grafana logs:

**On Linux with systemd:**

```bash
sudo journalctl -u grafana-server -f
```

**On Linux with log files:**

```bash
tail -f /var/log/grafana/grafana.log
```

**In Grafana UI:**

Navigate to **Administration > Settings > Server settings** to view system information and logs.

## Connection issues

### Issue: Cannot connect to data source

**Symptoms:**

- Error message: "Connection failed"
- Error message: "HTTP Error 502: Bad Gateway"
- Red "Failed" indicator when testing the data source

**Possible causes:**

- Incorrect URL or endpoint
- Network connectivity issues
- Firewall blocking requests
- Service is down or unavailable

**Solutions:**

Try the following solutions:

1. Verify the URL is correct and accessible:

```bash
curl [your-data-source-url]
```

2. Check that the Grafana server can reach the data source:

```bash
curl -I [your-data-source-url]
```

3. Verify firewall rules allow traffic from the Grafana server to the data source.

4. Check that the service is running and healthy.

5. Review the Grafana logs for detailed error messages:

```bash
tail -f /var/log/grafana/grafana.log | grep [plugin-id]
```

### Issue: Timeout errors

**Symptoms:**

- Error message: "Timeout exceeded"
- Queries take too long and eventually fail

**Possible causes:**

- Query returns too much data
- Data source is slow or overloaded
- Network latency is high
- Timeout setting is too low

**Solutions:**

1. Increase the timeout setting in the data source configuration:
   - Navigate to the data source settings
   - Increase the **Timeout** value (try 60 seconds)
   - Click **Save & test**

2. Optimize your queries to return less data:
   - Add filters to reduce the result set
   - Increase the time interval
   - Limit the number of series returned

3. Check the data source performance and resource usage.

### Issue: SSL/TLS certificate errors

**Symptoms:**

- Error message: "x509: certificate signed by unknown authority"
- Error message: "SSL certificate problem"

**Possible causes:**

- Self-signed certificate
- Certificate chain is incomplete
- Certificate has expired
- Certificate hostname mismatch

**Solutions:**

1. For development, skip TLS verification (not recommended for production):
   - In data source settings, enable **Skip TLS verify**
   - Click **Save & test**

2. For production, add the CA certificate:
   - In data source settings, enable **With CA cert**
   - Paste your CA certificate
   - Click **Save & test**

3. Verify the certificate is valid and not expired:

```bash
openssl s_client -connect [host]:[port] -showcerts
```

## Authentication issues

### Issue: Authentication failed

**Symptoms:**

- Error message: "401 Unauthorized"
- Error message: "403 Forbidden"
- Error message: "Invalid credentials"

**Possible causes:**

- Incorrect username or password
- API key is invalid or expired
- OAuth token is expired
- Insufficient permissions

**Solutions:**

1. Verify your credentials are correct:
   - Check for typos in username or password
   - Ensure API key is copied completely
   - Verify the credentials work outside Grafana

2. Check that the API key or token hasn't expired:
   - Generate a new API key from [service provider]
   - Update the data source configuration with the new key
   - Click **Save & test**

3. Verify the account has sufficient permissions:
   - Check that the account can access the required resources
   - Review the service's permission documentation

4. For OAuth, try refreshing the token:
   - Navigate to data source settings
   - Re-authorize the OAuth connection
   - Click **Save & test**

### Issue: Token expired

**Symptoms:**

- Error message: "Token expired"
- Queries work initially but fail after some time

**Solutions:**

1. Configure token refresh (if supported by the plugin).

2. Generate a new token and update the data source configuration.

3. Use a long-lived API key instead of short-lived tokens.

## Query issues

### Issue: No data returned

**Symptoms:**

- Empty graphs or tables
- Message: "No data"

**Possible causes:**

- Query syntax is incorrect
- Time range doesn't contain data
- Filters exclude all data
- Data source has no data for the query

**Solutions:**

1. Verify the query syntax is correct:
   - Check the [query syntax reference](query-syntax.md)
   - Test the query directly in the data source

2. Adjust the time range:
   - Expand the time range to include more data
   - Use absolute time ranges for testing

3. Review and remove filters that might exclude data.

4. Check that the data source contains data for the queried metrics or fields.

### Issue: Query syntax errors

**Symptoms:**

- Error message: "Parse error"
- Error message: "Invalid query"
- Red error indicators in the query editor

**Possible causes:**

- Syntax errors in the query
- Invalid field or metric names
- Unsupported query features

**Solutions:**

1. Review the query for syntax errors:
   - Check for typos in field names
   - Verify quotes and brackets are balanced
   - Ensure operators are used correctly

2. Refer to the [query syntax reference](query-syntax.md) for correct syntax.

3. Test the query with a simpler version to isolate the issue.

4. Check the plugin documentation for supported query features.

### Issue: Slow queries

**Symptoms:**

- Queries take a long time to execute
- Dashboard loading is slow
- Timeout errors

**Possible causes:**

- Query returns too much data
- Data source is slow or overloaded
- Inefficient query structure
- High network latency

**Solutions:**

1. Optimize your queries:
   - Add filters to reduce the result set
   - Limit the time range
   - Reduce the number of series returned
   - Use aggregation functions

2. Increase the **Max data points** setting to reduce the resolution.

3. Enable caching in the data source configuration (if supported).

4. Use query transformations to process data more efficiently.

## Plugin issues

### Issue: Plugin not appearing

**Symptoms:**

- Plugin doesn't appear in the plugins list
- Data source or panel type not available

**Possible causes:**

- Plugin not installed correctly
- Plugin files are in the wrong directory
- Grafana hasn't restarted after installation
- Plugin is unsigned and not allowed

**Solutions:**

1. Verify the plugin is installed in the correct directory:

```bash
ls -la /var/lib/grafana/plugins/[plugin-directory]
```

2. Check that the `plugin.json` file exists:

```bash
cat /var/lib/grafana/plugins/[plugin-directory]/plugin.json
```

3. Restart Grafana:

```bash
sudo systemctl restart grafana-server
```

4. For unsigned plugins, add to the allow list in `grafana.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = [your-plugin-id]
```

5. Check the Grafana logs for plugin loading errors:

```bash
grep "plugin" /var/log/grafana/grafana.log
```

### Issue: Plugin version incompatibility

**Symptoms:**

- Error message: "Plugin not compatible with Grafana version"
- Plugin fails to load

**Solutions:**

1. Check the plugin's compatibility with your Grafana version:
   - Review the plugin's `plugin.json` file
   - Check the plugin documentation for version requirements

2. Update Grafana to a compatible version, or install a different plugin version.

3. Contact the plugin author for compatibility information.

### Issue: Plugin crashes or errors

**Symptoms:**

- Browser console errors
- White screen or broken UI
- JavaScript errors in the console

**Solutions:**

1. Check the browser console for error messages:
   - Open browser developer tools (F12)
   - Navigate to the Console tab
   - Look for error messages

2. Clear the browser cache and reload:

```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (macOS)
```

3. Try a different browser to isolate browser-specific issues.

4. Check the Grafana logs for backend errors.

5. Verify the plugin version is the latest stable release.

## Performance issues

### Issue: High memory usage

**Symptoms:**

- Grafana uses excessive memory
- System becomes slow or unresponsive
- Out of memory errors

**Solutions:**

1. Reduce the number of queries per dashboard.

2. Lower the **Max data points** setting to reduce data volume.

3. Increase the **Min interval** to reduce query frequency.

4. Disable auto-refresh or increase the refresh interval.

5. Optimize queries to return less data.

### Issue: High CPU usage

**Symptoms:**

- Grafana server uses high CPU
- Queries are slow
- System becomes unresponsive

**Solutions:**

1. Reduce the query frequency by increasing refresh intervals.

2. Optimize queries to be more efficient.

3. Enable caching to reduce repeated query execution.

4. Scale the data source infrastructure if it's the bottleneck.

## Data issues

### Issue: Incorrect or unexpected data

**Symptoms:**

- Data doesn't match expectations
- Values are wrong
- Incorrect aggregations

**Possible causes:**

- Query returns wrong data
- Time zone issues
- Incorrect aggregation functions
- Data source configuration issues

**Solutions:**

1. Verify the query returns the expected data:
   - Test the query directly in the data source
   - Review the raw query response

2. Check time zone settings:
   - In the dashboard settings, verify the time zone
   - Check data source time zone configuration

3. Review aggregation functions in the query.

4. Check data source configuration for any data transformation settings.

### Issue: Missing data points

**Symptoms:**

- Gaps in time series graphs
- Some data points are missing

**Possible causes:**

- Data source has gaps in data
- Data resolution is too low
- Filters exclude some data points
- Data outside the visible time range

**Solutions:**

1. Verify the data source contains data for all time points.

2. Adjust the **Max data points** setting to increase resolution.

3. Review query filters that might exclude data.

4. Expand the time range to ensure data is visible.

5. Check the data source for data ingestion issues.

## Get help

If you can't resolve your issue using this guide:

1. **Search the documentation**: Review the [full documentation](README.md) for additional information.

2. **Check the FAQ**: Refer to the [FAQ](faq.md) for answers to common questions.

3. **Community forum**: Ask for help in the [Grafana Community](https://community.grafana.com/).

4. **GitHub issues**: Report bugs or request features on [GitHub](https://github.com/[your-username]/[your-plugin-repo]/issues).

5. **Contact support**: For commercial support, contact [[support contact information]].

## Report a bug

When reporting a bug, include the following information:

- Grafana version
- Plugin version
- Operating system
- Error messages from logs
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots (if applicable)

**Example bug report format**:

```
**Grafana version**: 10.0.0
**Plugin version**: 1.2.3
**OS**: Ubuntu 22.04

**Steps to reproduce**:
1. Configure data source with URL: https://example.com
2. Create a query: [example query]
3. Run query

**Expected behavior**: Query returns data
**Actual behavior**: Error message: "Connection failed"

**Logs**:
[Paste relevant log entries]

**Screenshot**:
[Attach screenshot if applicable]
```

## Next steps

- [Configuration guide](configuration.md)
- [Query syntax reference](query-syntax.md)
- [FAQ](faq.md)
