---
aliases:
  - ../../data-sources/loki/
  - ../../features/datasources/loki/
  - ../configure-loki-data-source/
description: Configure the Loki data source in Grafana
keywords:
  - grafana
  - loki
  - logging
  - guide
  - data source
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Loki data source
weight: 100
review_date: 2026-07-29
---

# Configure the Loki data source

This document explains how to configure the Loki data source and describes the available configuration options. For general information on adding and managing data sources, refer to [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

Grafana includes built-in support for Loki, so you don't need to install a plugin.

## Before you begin

Before you configure the data source, ensure you have:

- **Grafana permissions:** The `Organization administrator` role to add and configure data sources. Administrators can also configure the data source with [YAML provisioning](#provision-the-data-source).
- **Loki server URL:** The address of your Loki server, including the port. Loki listens on port `3100` by default.
- **Authentication details:** Any credentials or certificates your Loki server requires, such as a basic auth user and password or TLS certificates.

{{< admonition type="note" >}}
Use TLS (Transport Layer Security) for an additional layer of security when working with Loki. For information on setting up TLS encryption with Loki, refer to [Grafana Loki configuration parameters](https://grafana.com/docs/loki/latest/configure/).
{{< /admonition >}}

## Add the Loki data source

To add the Loki data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Loki` in the search bar.
1. Select the **Loki** data source.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab, where you set up your Loki configuration.

## Configure the data source in the UI

The following sections describe the configuration options available for the Loki data source.

The first options set the name of your connection:

| Setting     | Description                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Name**    | The data source name. This is how you refer to the data source in panels and queries. Examples: `loki-1`, `loki_logs`. |
| **Default** | Toggle to make this the default data source. Grafana selects it by default in new panels and queries.                  |

### Connection

Configure how Grafana connects to your Loki server.

| Setting | Description                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL** | The base URL of your Loki server. If Loki runs locally, use `http://localhost:3100`. If Loki runs on a networked server, use its URL and port, for example `http://loki.example.com:3100`. |

{{< admonition type="note" >}}
Enter only the base URL. Don't append API paths such as `/loki/api/v1/push`. That endpoint sends logs to Loki with an agent like Grafana Alloy; it isn't used to query Loki from the data source.

If your Grafana instance runs on Grafana Cloud, a `localhost` or private network address refers to Grafana's servers rather than your network, so it can't reach a self-hosted Loki. Use [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) to query Loki on a private network.
{{< /admonition >}}

### Authentication

Configure how Grafana authenticates with your Loki server. Select an authentication method and provide any required credentials.

| Setting                    | Description                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Basic authentication**   | The most common authentication method. Enter the user name and password for your Loki server.                                                   |
| **Forward OAuth Identity** | Toggle on to forward the OAuth access token, and the OIDC ID token if available, of the user querying the data source.                          |
| **With credentials**       | Toggle on to send credentials such as cookies or authentication headers with cross-site requests.                                               |
| **TLS Client Auth**        | Toggle on to authenticate with a client certificate. Provide the **Server name**, **Client cert**, and **Client key**.                          |
| **With CA cert**           | Toggle on to verify a self-signed TLS certificate. Follow the instructions from your certificate authority (CA) to obtain the certificate file. |
| **Skip TLS verify**        | Toggle on to bypass TLS certificate verification. Skipping verification isn't recommended unless absolutely necessary or for testing.           |

{{< admonition type="note" >}}
For Grafana Cloud–hosted Loki, use **Basic authentication** with your Grafana Cloud user ID as the user name and a Cloud Access Policy token as the password. The token's [access policy](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/) must include the `logs:read` scope. Create tokens in the Grafana Cloud Portal. A token's value is shown only once, so copy it when you create it.
{{< /admonition >}}

#### Custom HTTP headers

Add custom HTTP headers to pass values that your Loki instance requires.

| Setting    | Description                    |
| ---------- | ------------------------------ |
| **Header** | The name of the custom header. |
| **Value**  | The value of the header.       |

For a multi-tenant Loki, one configured with `auth_enabled: true`, add the `X-Scope-OrgID` header with your tenant ID so Loki knows which tenant to query. Without it, queries against a multi-tenant Loki fail with an authentication error or return no data.

### Additional settings

The **Additional settings** section is collapsible and contains optional settings that give you more control over the data source. It's open by default and includes advanced HTTP settings, alerting, query, and derived field options.

#### Advanced HTTP settings

Configure additional HTTP behavior for requests to Loki.

| Setting             | Description                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Allowed cookies** | Specify cookies by name that should be forwarded to the data source. By default, the Grafana proxy deletes forwarded cookies. |
| **Timeout**         | The HTTP request timeout, in seconds. There's no default, so set a value that suits your queries.                             |

#### Secure Socks Proxy

The **Secure Socks Proxy** settings appear only when the secure SOCKS data source proxy is enabled in the Grafana configuration file. When enabled, you can route data source requests through a secure SOCKS proxy. For more information, refer to [Configure a datasource connection proxy](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/proxy/).

#### Alerting

Configure how the data source works with [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

| Setting                               | Description                                                                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manage alert rules in Alerting UI** | Toggle on to manage data source-managed alert rules for the Loki data source in the Grafana Alerting UI. These rules are stored and evaluated by the Loki ruler. The default follows your Grafana configuration. |

To manage other alerting resources, such as the alerts these rules generate, add an [Alertmanager data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/alertmanager/). For more information on alerting with Loki, refer to [Loki alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/alerting/).

#### Queries

Configure query behavior for the data source.

| Setting           | Description                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maximum lines** | Sets the maximum number of log lines Loki returns. Increase the limit for a larger result set for ad hoc analysis. Decrease the limit if your browser is slow when displaying log results. The default is `1000`. |

#### Derived fields

Use derived fields to extract new fields from your logs and create a link from the value of the field.

For example, you can link to your tracing backend directly from your logs, or link to a user profile page when a log line contains a corresponding `userId`. These links appear in the [log details](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields).

You can add multiple derived fields.

{{< admonition type="note" >}}
If you use Grafana Cloud, you can request modifications to this feature by opening a support ticket from the Grafana Cloud Portal.
{{< /admonition >}}

Each derived field has the following options:

| Setting                      | Description                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**                     | The field name. Displayed as a label in the log details.                                                                                                                                                                                   |
| **Type**                     | The type of the derived field. Choose **Regex in log line** to parse a value from the log content, or **Label** to match a label key.                                                                                                      |
| **Regex**                    | When the type is **Regex in log line**, a regular expression that parses part of the log message. Include a capture group; Grafana uses the first captured group as the field value.                                                       |
| **Label**                    | When the type is **Label**, the input matches as a regular expression against label keys, so a pattern like `trace[_]?id` matches variations such as `traceid` and `trace_id`. Matches any label: indexed, parsed, or structured metadata. |
| **URL/query**                | The full link URL for external links, or a query for the target data source for internal links. Interpolate the field value with the `${__value.raw}` macro.                                                                               |
| **URL Label**                | _Optional._ A custom display label for the link. Overrides the default label, which is the full external URL or the name of the linked internal data source.                                                                               |
| **Internal link**            | Toggle on to define an internal link to a tracing data source. Select the target data source from the selector.                                                                                                                            |
| **Open in new tab**          | Toggle on to open the link in a new tab or window.                                                                                                                                                                                         |
| **Show example log message** | Paste an example log line to test the regular expression of your derived fields.                                                                                                                                                           |

{{< admonition type="caution" >}}
Using complex regular expressions in either type can affect browser performance when processing large volumes of logs. Use simpler patterns when possible.
{{< /admonition >}}

{{< admonition type="note" >}}
A derived field produces a single value per log line, so you can't combine multiple labels or capture groups into one field or link.

For an internal link, the derived field only builds a link to the target data source using the extracted value. The trace must already be ingested into the target data source, such as Tempo, for the link to resolve. If a matching trace doesn't exist, the link opens the target data source but returns no trace.
{{< /admonition >}}

##### Troubleshoot interpolation

Use the debug section to see what your fields extract and how the URL interpolates. Click **Show example log message** to display a text area where you can enter a log message.

{{< figure src="/static/img/docs/v75/loki_derived_fields_settings.png" class="docs-image--no-shadow" max-width="800px" caption="Screenshot of the derived fields debug section" >}}

The new field with the link appears in the log details:

{{< figure src="/static/img/docs/explore/data-link-9-4.png" max-width="800px" caption="Data link in Explore" >}}

## Verify the connection

Click **Save & test** at the bottom of the settings. Grafana attempts to connect to your Loki server and query its labels. When the test succeeds, Grafana displays a success message confirming the data source is working. If the test fails, review the error message and refer to [Troubleshoot Loki issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/troubleshooting/).

{{< admonition type="note" >}}
To troubleshoot configuration and other issues, check the log file located at `/var/log/grafana/grafana.log` on Unix systems, or in `<grafana_install_dir>/data/log` on other platforms and manual installations.
{{< /admonition >}}

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system. For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

### Provisioning examples

The following example provisions a basic Loki data source:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    jsonData:
      timeout: 60
      maxLines: 1000
```

**Using basic authorization and a derived field:**

You must escape the dollar (`$`) character in YAML values because it can be used to interpolate environment variables:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    basicAuth: true
    basicAuthUser: my_user
    jsonData:
      maxLines: 1000
      derivedFields:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          matcherRegex: "traceID=(\\w+)"
          name: TraceID
          # url will be interpreted as query for the datasource
          url: '$${__value.raw}'
          # optional for URL Label to set a custom display label for the link.
          urlDisplayLabel: 'View Trace'

        # Field with external link.
        - matcherRegex: "traceID=(\\w+)"
          name: TraceID
          url: 'http://localhost:16686/trace/$${__value.raw}'
    secureJsonData:
      basicAuthPassword: test_password
```

**Using a Jaeger data source:**

In this example, the Jaeger data source's `uid` value should match the Loki data source's `datasourceUid` value.

```yaml
datasources:
  - name: Jaeger
    type: jaeger
    url: http://jaeger-tracing-query:16686/
    access: proxy
    # UID should match the datasourceUid in derivedFields.
    uid: my_jaeger_uid
```

## Configure with Terraform

You can configure the Loki data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/).

The following example provisions a Loki data source with a maximum line limit:

```hcl
resource "grafana_data_source" "loki" {
  name = "Loki"
  type = "loki"
  url  = "http://localhost:3100"

  json_data_encoded = jsonencode({
    maxLines = 1000
  })
}
```

The following example uses basic authentication and defines a derived field that links to a Jaeger data source:

```hcl
resource "grafana_data_source" "loki" {
  name           = "Loki"
  type           = "loki"
  url            = "http://localhost:3100"
  basic_auth_enabled  = true
  basic_auth_username = "my_user"

  json_data_encoded = jsonencode({
    maxLines = 1000
    derivedFields = [
      {
        datasourceUid   = "my_jaeger_uid"
        matcherRegex    = "traceID=(\\w+)"
        name            = "TraceID"
        url             = "$${__value.raw}"
        urlDisplayLabel = "View Trace"
      }
    ]
  })

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = "<LOKI_PASSWORD>"
  })
}
```

Replace the placeholders with your own values:

- `<LOKI_PASSWORD>`: The password for the basic authentication user.

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).
