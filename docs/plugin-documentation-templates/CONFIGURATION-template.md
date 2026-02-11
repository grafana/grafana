# Configure [Plugin Name]

This guide shows you how to configure [Plugin Name].

## Data source configuration

### Add a data source

To add a [Plugin Name] data source:

1. Click **Connections** in the main menu.
2. Click **Add new connection**.
3. Search for "[Plugin Name]".
4. Click **Create a [Plugin Name] data source**.

### Connection settings

Configure the following connection settings:

#### Name

Enter a descriptive name for this data source. This name appears in data source lists and dropdowns.

**Example**: `My [Plugin Name] Instance`

#### URL

Enter the URL endpoint for your [service/database/API].

**Format**: `[protocol]://[host]:[port]/[path]`

**Examples**:
- `https://api.example.com`
- `http://localhost:9090`
- `https://example.com/api/v1`

#### Access

Select the access mode:

- **Server (default)**: Grafana server sends requests to the data source. Use this mode for most cases.
- **Browser**: The browser sends requests directly to the data source. Use this mode when the data source is accessible from the browser but not from the Grafana server.

### Authentication

[Plugin Name] supports the following authentication methods:

#### No authentication

Select this option if your data source doesn't require authentication.

#### Basic authentication

To use basic authentication:

1. Enable **Basic auth**.
2. Enter the following credentials:
   - **User**: Your username
   - **Password**: Your password

#### API key authentication

To use API key authentication:

1. Enable **Custom HTTP headers**.
2. Add a header:
   - **Header**: `Authorization` (or your API's header name)
   - **Value**: `Bearer <API_KEY>` (replace `<API_KEY>` with your actual API key)

Replace `<API_KEY>` with your API key from [service provider].

#### OAuth 2.0 authentication

To use OAuth 2.0 authentication:

1. Enable **OAuth 2.0**.
2. Configure the following settings:
   - **Client ID**: Your OAuth client ID
   - **Client Secret**: Your OAuth client secret
   - **Token URL**: The OAuth token endpoint
   - **Scopes**: Required OAuth scopes

Refer to [service documentation] for OAuth configuration details.

### Additional settings

Configure optional settings based on your needs:

#### Timeout

Set the HTTP request timeout in seconds. The default is 30 seconds.

Increase this value if your queries take longer than 30 seconds to execute.

#### Keep cookies

Enable this option to forward cookies from the browser to the data source.

Use this option when the data source requires session cookies for authentication.

#### TLS/SSL settings

Configure TLS/SSL settings if your data source uses HTTPS with custom certificates:

- **Skip TLS verify**: Skip TLS certificate verification (not recommended for production)
- **With CA cert**: Provide a custom CA certificate
- **With client cert**: Provide a client certificate for mutual TLS

#### Custom HTTP headers

Add custom HTTP headers to include with every request:

1. Click **Add header**.
2. Enter the header name and value.
3. Click **Add** to save the header.

**Example headers**:
- `X-Custom-Header: value`
- `X-API-Version: 1.0`

### Query options

Configure default query behavior:

#### Max data points

Set the maximum number of data points to return per series. The default is determined by panel width.

Lower values improve performance but may reduce visualization detail.

#### Min interval

Set the minimum time interval between data points.

**Examples**:
- `1s` for 1 second
- `1m` for 1 minute
- `1h` for 1 hour

## Test the connection

After configuring the data source:

1. Click **Save & test**.
2. Confirm you see a success message: "Data source is working".

If the connection fails, refer to the [Troubleshooting guide](troubleshooting.md) for common issues and solutions.

## Plugin-specific configuration

### [Feature 1 configuration]

[Detailed configuration for feature 1]

### [Feature 2 configuration]

[Detailed configuration for feature 2]

## Environment variables

You can configure [Plugin Name] using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `GF_[PLUGIN]_[SETTING]` | [Description] | [Default value] |

**Example**:

```bash
export GF_DATASOURCES_DEFAULT_NAME="My Data Source"
```

## Provisioning

You can provision [Plugin Name] data sources using configuration files.

Create a YAML file in the provisioning directory:

**Location**: `/etc/grafana/provisioning/datasources/`

**Example configuration**:

```yaml
apiVersion: 1

datasources:
  - name: [Plugin Name]
    type: [plugin-id]
    access: proxy
    url: https://api.example.com
    basicAuth: true
    basicAuthUser: username
    secureJsonData:
      basicAuthPassword: password
    jsonData:
      timeout: 60
      # Add plugin-specific options here
```

Refer to [Grafana provisioning documentation](https://grafana.com/docs/grafana/latest/administration/provisioning/) for more details.

## Advanced configuration

### Configure in grafana.ini

You can configure plugin settings in the `grafana.ini` file:

```ini
[plugin.[your-plugin-id]]
setting_name = value
```

**Example**:

```ini
[plugin.mycompany-plugin]
api_endpoint = https://api.example.com
timeout = 60
```

### Configure with environment variables

Override configuration using environment variables:

```bash
GF_PLUGIN_MYCOMPANY_PLUGIN_API_ENDPOINT=https://api.example.com
GF_PLUGIN_MYCOMPANY_PLUGIN_TIMEOUT=60
```

## Security considerations

When configuring [Plugin Name], follow these security best practices:

- Store sensitive credentials in Grafana's secure JSON data storage
- Use HTTPS endpoints when possible
- Enable TLS certificate verification in production
- Rotate API keys regularly
- Use the principle of least privilege for service accounts
- Avoid storing credentials in provisioning files (use secure JSON data instead)

## Configuration examples

### Example 1: [Common configuration scenario]

[Detailed example with configuration values]

### Example 2: [Another common scenario]

[Detailed example with configuration values]

## Next steps

- [Quick start guide](quick-start.md)
- [Query data](querying.md)
- [Troubleshooting guide](troubleshooting.md)
