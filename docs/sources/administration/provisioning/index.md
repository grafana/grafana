---
aliases:
  - ../installation/provisioning/
description: Describes provisioning settings for Grafana using configuration files.
keywords:
  - grafana
  - provisioning
  - provision
labels:
  products:
    - enterprise
    - oss
title: Provision Grafana
weight: 600
---

# Provision Grafana

Grafana has an active provisioning system that uses configuration files. You can define data sources and dashboards using files that can be version controlled, making GitOps more natural.

## Configuration file

Refer to [Configuration](../../setup-grafana/configure-grafana/) for more information on what you can configure in `grafana.ini`.

### Configuration file locations

Grafana reads its default configuration from `<WORKING DIRECTORY>/conf/defaults.ini`.

Grafana reads custom configuration from `<WORKING DIRECTORY>/conf/custom.ini`. You can override the custom configuration path with the `--config` option.

{{< admonition type="note" >}}
The Deb and RPM packages install the configuration file at `/etc/grafana/grafana.ini`.
The Grafana init.d script sets the `--config` option to that path.
{{< /admonition >}}

## Use environment variables

You can use environment variable lookups in all provisioning configuration. The syntax for an environment variable is `$ENV_VAR_NAME` or `${ENV_VAR_NAME}`.

The following applies:

- Only use environment variables for configuration values. Do not use it for keys or bigger parts of the configuration file structure.
- Use environment variables in dashboard provisioning configuration, but not in the dashboard definition files themselves.

The following example looks up the data source URL port, user, and password using environment variables:

```yaml
datasources:
  - name: Graphite
    url: http://localhost:$PORT
    user: $USER
    secureJsonData:
      password: $PASSWORD
```

### Use of the special character "$"

Grafana's expansion feature considers any value after an `$` a variable, and converts `$$` into a single `$`.

For example, if you want `Pa$sword` as a final value:

- Use the `$ENV_VAR_NAME` syntax to avoid double expansion.
- Use `Pa$$sw0rd` in the environment variable value before the expansion in order to escape a literal `$`.

## Configuration management tools

The Grafana community maintains libraries for many popular configuration management tools.

| Tool      | Project                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Puppet    | <https://forge.puppet.com/puppet/grafana>                                                                                         |
| Ansible   | <https://github.com/grafana/grafana-ansible-collection>                                                                           |
| Chef      | <https://github.com/sous-chefs/chef-grafana>                                                                                      |
| Saltstack | <https://github.com/salt-formulas/salt-formula-grafana>                                                                           |
| Jsonnet   | <https://github.com/grafana/grafonnet-lib/>)                                                                                      |
| NixOS     | [`services.grafana.provision` module](https://github.com/NixOS/nixpkgs/blob/master/nixos/modules/services/monitoring/grafana.nix) |

## Data sources

You can manage data sources in Grafana by adding YAML configuration files in the [`provisioning/datasources`](../../setup-grafana/configure-grafana/#provisioning) directory.
Each configuration file contains a list of data sources, under the `datasources` key, to add or update during startup.
If the data source already exists, Grafana reconfigures it to match the provisioned configuration file.

You can also list data sources to automatically delete, using the key `deleteDatasources`.
Grafana deletes the data sources listed in `deleteDatasources` _before_ adding or updating those in the `datasources` list.

You can configure Grafana to automatically delete provisioned data sources when they're removed from the provisioning file.
To do so, add `prune: true` to the root of your data source provisioning file.
With this configuration, Grafana also removes the provisioned data sources if you remove the provisioning file entirely.

### Run multiple Grafana instances

If you run multiple instances of Grafana, add a version number to each data source in the configuration and increase it when you update the configuration.
Grafana only updates data sources with the same or lower version number than the one set in the configuration file.
This prevents old configurations from overwriting newer ones if you have different versions of the `datasource.yaml` file that don't define version numbers, and then restart instances at the same time.

### Example data source configuration file

This example provisions a [Graphite data source](../../datasources/graphite/):

```yaml
# Configuration file version
apiVersion: 1

# List of data sources to delete from the database.
deleteDatasources:
  - name: Graphite
    orgId: 1

# Mark provisioned data sources for deletion if they are no longer in a provisioning file.
# It takes no effect if data sources are already listed in the deleteDatasources section.
prune: true

# List of data sources to insert/update depending on what's
# available in the database.
datasources:
  # <string, required> Sets the name you use to refer to
  # the data source in panels and queries.
  - name: Graphite
    # <string, required> Sets the data source type.
    type: graphite
    # <string, required> Sets the access mode, either
    # proxy or direct (Server or Browser in the UI).
    # Some data sources are incompatible with any setting
    # but proxy (Server).
    access: proxy
    # <int> Sets the organization id. Defaults to orgId 1.
    orgId: 1
    # <string> Sets a custom UID to reference this
    # data source in other parts of the configuration.
    # If not specified, Grafana generates one.
    uid: my_unique_uid
    # <string> Sets the data source's URL, including the
    # port.
    url: http://localhost:8080
    # <string> Sets the database user, if necessary.
    user:
    # <string> Sets the database name, if necessary.
    database:
    # <bool> Enables basic authorization.
    basicAuth:
    # <string> Sets the basic authorization username.
    basicAuthUser:
    # <bool> Enables credential headers.
    withCredentials:
    # <bool> Toggles whether the data source is pre-selected
    # for new panels. You can set only one default
    # data source per organization.
    isDefault:
    # <map> Fields to convert to JSON and store in jsonData.
    jsonData:
      # <string> Defines the Graphite service's version.
      graphiteVersion: '1.1'
      # <bool> Enables TLS authentication using a client
      # certificate configured in secureJsonData.
      tlsAuth: true
      # <bool> Enables TLS authentication using a CA
      # certificate.
      tlsAuthWithCACert: true
    # <map> Fields to encrypt before storing in jsonData.
    secureJsonData:
      # <string> Defines the CA cert, client cert, and
      # client key for encrypted authentication.
      tlsCACert: '...'
      tlsClientCert: '...'
      tlsClientKey: '...'
      # <string> Sets the database password, if necessary.
      password:
      # <string> Sets the basic authorization password.
      basicAuthPassword:
    # <int> Sets the version. Used to compare versions when
    # updating. Ignored when creating a new data source.
    version: 1
    # <bool> Allows users to edit data sources from the
    # Grafana UI.
    editable: false
```

For provisioning examples of specific data sources, refer to that [data source's documentation](../../datasources/).

#### JSON data

Not all data sources have the same configuration settings, only the most common ones are fields in the data source provisioning file.
To provision the rest of a data source's settings, include them as JSON in the `jsonData` field.

Common settings in the [built-in core data sources](../../datasources/#built-in-core-data-sources) include:

| Name                            | Type    | Data source                                                      | Description                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tlsAuth`                       | boolean | _HTTP\*_, MySQL                                                  | Enable TLS authentication using client cert configured in secure JSON data                                                                                                                                                                                                                    |
| `tlsAuthWithCACert`             | boolean | _HTTP\*_, MySQL, PostgreSQL                                      | Enable TLS authentication using CA cert                                                                                                                                                                                                                                                       |
| `tlsSkipVerify`                 | boolean | _HTTP\*_, MySQL, PostgreSQL, MSSQL                               | Controls whether a client verifies the server's certificate chain and host name.                                                                                                                                                                                                              |
| `serverName`                    | string  | _HTTP\*_, MSSQL                                                  | Optional. Controls the server name used for certificate common name/subject alternative name verification. Defaults to using the data source URL.                                                                                                                                             |
| `timeout`                       | string  | _HTTP\*_                                                         | Request timeout in seconds. Overrides `dataproxy.timeout` option                                                                                                                                                                                                                              |
| `graphiteVersion`               | string  | Graphite                                                         | Graphite version                                                                                                                                                                                                                                                                              |
| `timeInterval`                  | string  | Prometheus, Elasticsearch, InfluxDB, MySQL, PostgreSQL and MSSQL | Lowest interval/step value that should be used for this data source.                                                                                                                                                                                                                          |
| `httpMode`                      | string  | InfluxDB                                                         | HTTP Method. 'GET', 'POST', defaults to GET                                                                                                                                                                                                                                                   |
| `maxSeries`                     | number  | InfluxDB                                                         | Max number of series/tables that Grafana processes                                                                                                                                                                                                                                            |
| `httpMethod`                    | string  | Prometheus                                                       | HTTP Method. 'GET', 'POST', defaults to POST                                                                                                                                                                                                                                                  |
| `customQueryParameters`         | string  | Prometheus                                                       | Query parameters to add, as a URL-encoded string.                                                                                                                                                                                                                                             |
| `manageAlerts`                  | boolean | Prometheus and Loki                                              | Manage alerts via Alerting UI                                                                                                                                                                                                                                                                 |
| `alertmanagerUid`               | string  | Prometheus and Loki                                              | UID of Alertmanager that manages Alert for this data source.                                                                                                                                                                                                                                  |
| `timeField`                     | string  | Elasticsearch                                                    | Which field that should be used as timestamp                                                                                                                                                                                                                                                  |
| `interval`                      | string  | Elasticsearch                                                    | Index date time format. nil(No Pattern), 'Hourly', 'Daily', 'Weekly', 'Monthly' or 'Yearly'                                                                                                                                                                                                   |
| `logMessageField`               | string  | Elasticsearch                                                    | Which field should be used as the log message                                                                                                                                                                                                                                                 |
| `logLevelField`                 | string  | Elasticsearch                                                    | Which field should be used to indicate the priority of the log message                                                                                                                                                                                                                        |
| `maxConcurrentShardRequests`    | number  | Elasticsearch                                                    | Maximum number of concurrent shard requests that each sub-search request executes per node                                                                                                                                                                                                    |
| `sigV4Auth`                     | boolean | Elasticsearch and Prometheus                                     | Enable usage of SigV4                                                                                                                                                                                                                                                                         |
| `sigV4AuthType`                 | string  | Elasticsearch and Prometheus                                     | SigV4 auth provider. default/credentials/keys                                                                                                                                                                                                                                                 |
| `sigV4ExternalId`               | string  | Elasticsearch and Prometheus                                     | Optional SigV4 External ID                                                                                                                                                                                                                                                                    |
| `sigV4AssumeRoleArn`            | string  | Elasticsearch and Prometheus                                     | Optional SigV4 ARN role to assume                                                                                                                                                                                                                                                             |
| `sigV4Region`                   | string  | Elasticsearch and Prometheus                                     | SigV4 AWS region                                                                                                                                                                                                                                                                              |
| `sigV4Profile`                  | string  | Elasticsearch and Prometheus                                     | Optional SigV4 credentials profile                                                                                                                                                                                                                                                            |
| `authType`                      | string  | Amazon CloudWatch                                                | Auth provider. default/credentials/keys                                                                                                                                                                                                                                                       |
| `externalId`                    | string  | Amazon CloudWatch                                                | Optional External ID                                                                                                                                                                                                                                                                          |
| `assumeRoleArn`                 | string  | Amazon CloudWatch                                                | Optional ARN role to assume                                                                                                                                                                                                                                                                   |
| `defaultRegion`                 | string  | Amazon CloudWatch                                                | Optional default AWS region                                                                                                                                                                                                                                                                   |
| `customMetricsNamespaces`       | string  | Amazon CloudWatch                                                | Namespaces of Custom Metrics                                                                                                                                                                                                                                                                  |
| `profile`                       | string  | Amazon CloudWatch                                                | Optional credentials profile                                                                                                                                                                                                                                                                  |
| `tsdbVersion`                   | string  | OpenTSDB                                                         | Version                                                                                                                                                                                                                                                                                       |
| `tsdbResolution`                | string  | OpenTSDB                                                         | Resolution                                                                                                                                                                                                                                                                                    |
| `sslmode`                       | string  | PostgreSQL                                                       | SSL mode. 'disable', 'require', 'verify-ca' or 'verify-full'                                                                                                                                                                                                                                  |
| `tlsConfigurationMethod`        | string  | PostgreSQL                                                       | SSL certificate configuration, either by 'file-path' or 'file-content'                                                                                                                                                                                                                        |
| `sslRootCertFile`               | string  | PostgreSQL, MSSQL                                                | SSL server root certificate file, must be readable by the Grafana user                                                                                                                                                                                                                        |
| `sslCertFile`                   | string  | PostgreSQL                                                       | SSL client certificate file, must be readable by the Grafana user                                                                                                                                                                                                                             |
| `sslKeyFile`                    | string  | PostgreSQL                                                       | SSL client key file, must be readable by _only_ the Grafana user                                                                                                                                                                                                                              |
| `encrypt`                       | string  | MSSQL                                                            | Determines SSL encryption handling. Options include: `disable` - data sent between client and server is not encrypted; `false` - data sent between client and server is not encrypted beyond the login packet; `true` - data sent between client and server is encrypted. Default is `false`. |
| `postgresVersion`               | number  | PostgreSQL                                                       | Postgres version as a number (903/904/905/906/1000) meaning v9.3, v9.4, ..., v10                                                                                                                                                                                                              |
| `timescaledb`                   | boolean | PostgreSQL                                                       | Enable usage of TimescaleDB extension                                                                                                                                                                                                                                                         |
| `maxOpenConns`                  | number  | MySQL, PostgreSQL and MSSQL                                      | Maximum number of open connections to the database (Grafana v5.4+)                                                                                                                                                                                                                            |
| `maxIdleConns`                  | number  | MySQL, PostgreSQL and MSSQL                                      | Maximum number of connections in the idle connection pool (Grafana v5.4+)                                                                                                                                                                                                                     |
| `connMaxLifetime`               | number  | MySQL, PostgreSQL and MSSQL                                      | Maximum amount of time in seconds a connection may be reused (Grafana v5.4+)                                                                                                                                                                                                                  |
| `keepCookies`                   | array   | _HTTP\*_                                                         | Cookies that needs to be passed along while communicating with data sources                                                                                                                                                                                                                   |
| `prometheusVersion`             | string  | Prometheus                                                       | The version of the Prometheus data source, such as `2.37.0`, `2.24.0`                                                                                                                                                                                                                         |
| `prometheusType`                | string  | Prometheus                                                       | Prometheus database type. Options are `Prometheus`, `Cortex`, `Mimir` or`Thanos`.                                                                                                                                                                                                             |
| `cacheLevel`                    | string  | Prometheus                                                       | Determines the duration of the browser cache. Valid values include: `Low`, `Medium`, `High`, and `None`.                                                                                                                                                                                      |
| `incrementalQuerying`           | string  | Prometheus                                                       | Experimental: Turn on incremental querying to enhance dashboard reload performance with slow data sources                                                                                                                                                                                     |
| `incrementalQueryOverlapWindow` | string  | Prometheus                                                       | Experimental: Configure incremental query overlap window. Requires a valid duration string, for example, `180s` or `15m` Default value is `10m` (10 minutes).                                                                                                                                 |
| `disableRecordingRules`         | boolean | Prometheus                                                       | Experimental: Turn off Prometheus recording rules                                                                                                                                                                                                                                             |
| `implementation`                | string  | Alertmanager                                                     | The implementation of the Alertmanager data source, such as `prometheus`, `cortex` or `mimir`                                                                                                                                                                                                 |
| `handleGrafanaManagedAlerts`    | boolean | Alertmanager                                                     | When enabled, Grafana-managed alerts are sent to this Alertmanager                                                                                                                                                                                                                            |

{{< admonition type="note" >}}
Data sources tagged with _HTTP\*_ communicate using the HTTP protocol, which includes all core data source plugins except MySQL, PostgreSQL, and MSSQL.
{{< /admonition >}}

For examples of specific data sources' JSON data, refer to that [data source's documentation](../../datasources/).

#### Secure JSON data

Secure JSON data is a map of settings encrypted with a [secret key](../../setup-grafana/configure-grafana/#secret_key).
The encryption hides the JSON data from the users of Grafana.
You should use secure JSON data to store TLS certificates and passwords for data source HTTP requests.
All of these settings are optional.

| Name                | Type   | Data source                        | Description                                              |
| ------------------- | ------ | ---------------------------------- | -------------------------------------------------------- |
| `tlsCACert`         | string | _HTTP\*_, MySQL, PostgreSQL        | CA cert for out going requests                           |
| `tlsClientCert`     | string | _HTTP\*_, MySQL, PostgreSQL        | TLS Client cert for outgoing requests                    |
| `tlsClientKey`      | string | _HTTP\*_, MySQL, PostgreSQL        | TLS Client key for outgoing requests                     |
| `password`          | string | _HTTP\*_, MySQL, PostgreSQL, MSSQL | password                                                 |
| `basicAuthPassword` | string | _HTTP\*_                           | password for basic authentication                        |
| `accessKey`         | string | Amazon CloudWatch                  | Access key for connecting to Amazon CloudWatch           |
| `secretKey`         | string | Amazon CloudWatch                  | Secret key for connecting to Amazon CloudWatch           |
| `sigV4AccessKey`    | string | Elasticsearch and Prometheus       | SigV4 access key. Required when using keys auth provider |
| `sigV4SecretKey`    | string | Elasticsearch and Prometheus       | SigV4 secret key. Required when using keys auth provider |

{{< admonition type="note" >}}
The _HTTP\*_ tag denotes data sources that communicate using the HTTP protocol, including all core data source plugins except MySQL, PostgreSQL, and MSSQL.
{{< /admonition >}}

#### Custom HTTP headers for data sources

You can add HTTP headers to all requests sent to data sources managed by Grafana provisioning
Configure the header name in the `jsonData` field and the header value in `secureJsonData`.
The following example sets the `HeaderName` header to have the value `HeaderValue` and the `Authorization` header to have the value `Bearer XXXXXXXXX`:

```yaml
apiVersion: 1

datasources:
  - name: Graphite
    jsonData:
      httpHeaderName1: 'HeaderName'
      httpHeaderName2: 'Authorization'
    secureJsonData:
      httpHeaderValue1: 'HeaderValue'
      httpHeaderValue2: 'Bearer XXXXXXXXX'
```

## Plugins

You can manage plugin applications in Grafana by adding one or more YAML configuration files in the [`provisioning/plugins`](../../setup-grafana/configure-grafana/#provisioning) directory.
Each configuration file contains a list of `apps` that Grafana configures during start up.
Grafana configures each app to use the configuration in the file.

{{< admonition type="note" >}}
This feature enables you to provision plugin configurations, not the plugins themselves.
You must have already installed the plugin to use plugin configuration provisioning.
{{< /admonition >}}

### Example plugin configuration file

```yaml
apiVersion: 1

apps:
  # <string> the type of app, plugin identifier. Required
  - type: raintank-worldping-app
    # <int> Org ID. Default to 1, unless org_name is specified
    org_id: 1
    # <string> Org name. Overrides org_id unless org_id not specified
    org_name: Main Org.
    # <bool> disable the app. Default to false.
    disabled: false
    # <map> fields that will be converted to json and stored in jsonData. Custom per app.
    jsonData:
      # key/value pairs of string to object
      key: value
    # <map> fields that will be converted to json, encrypted and stored in secureJsonData. Custom per app.
    secureJsonData:
      # key/value pairs of string to string
      key: value
```

## Dashboards

You can manage dashboards in Grafana by adding one or more YAML configuration files in the [`provisioning/dashboards`](../../setup-grafana/configure-grafana/#dashboards) directory.
Each configuration file contains a list of `providers` that Grafana uses to load dashboards from the local filesystem.

### Example dashboard configuration file

```yaml
apiVersion: 1

providers:
  # <string> an unique provider name. Required
  - name: 'a unique provider name'
    # <int> Org id. Default to 1
    orgId: 1
    # <string> name of the dashboard folder.
    folder: ''
    # <string> folder UID. will be automatically generated if not specified
    folderUid: ''
    # <string> provider type. Default to 'file'
    type: file
    # <bool> disable dashboard deletion
    disableDeletion: false
    # <int> how often Grafana will scan for changed dashboards
    updateIntervalSeconds: 10
    # <bool> allow updating provisioned dashboards from the UI
    allowUiUpdates: false
    options:
      # <string, required> path to dashboard files on disk. Required when using the 'file' type
      path: /var/lib/grafana/dashboards
      # <bool> use folder names from filesystem to create folders in Grafana
      foldersFromFilesStructure: true
```

When Grafana starts, it updates or creates all dashboards found in the configured path.
It later polls that path every `updateIntervalSeconds` for updates to the dashboard files and updates its database.

{{< admonition type="note" >}}
Grafana installs dashboards at the root level if you don't set the `folder` field.
{{< /admonition >}}

#### Make changes to a provisioned dashboard

You can make changes to a provisioned dashboard in the Grafana UI but its not possible to automatically save the changes back to the provisioning source.
If `allowUiUpdates` is set to `true` and you make changes to a provisioned dashboard, when you save the dashboard, Grafana persists the changes to its database.

{{< admonition type="caution" >}}
If you save a provisioned dashboard in the UI and then later update the provisioning source, Grafana always overwrites the database dashboard with the one from the provisioning file.
Grafana ignores the `version` property in the JSON file, even if it's lower than the dashboard in the database.
{{< /admonition >}}

{{< admonition type="caution" >}}
If you save a provisioned dashboard in the UI and remove the provisioning source, Grafana deletes the dashboard in the database unless you have set the option `disableDeletion` to `true`.
{{< /admonition >}}

If you set `allowUiUpdates` to `false`, you can't save changes to a provisioned dashboard.
When you try to save changes to a provisioned dashboard, Grafana brings up a _Cannot save provisioned dashboard_ dialog box.

Grafana offers options to export the JSON definition of a dashboard.
Use either **Copy JSON to Clipboard** or **Save JSON to file** to sync your dashboard changes back to the provisioning source.
Grafana removes the `id` field from the dashboard JSON to help the provisioning workflow.

The following screenshot illustrates this behavior.

{{< figure src="/static/img/docs/v51/provisioning_cannot_save_dashboard.png" max-width="500px" class="docs-image--no-shadow" >}}

### Reusable dashboard URLs

If the dashboard in the JSON file contains an [UID](../../dashboards/build-dashboards/view-dashboard-json-model/), Grafana updates that the dashboard with that UID in the database.
This lets you migrate dashboards between Grafana instances and keep consistent dashboard URLs.
When Grafana starts, it creates or updates all dashboards available in the configured folders.

{{< admonition type="caution" >}}
You can overwrite existing dashboards with provisioning.

Be careful not to reuse the same `title` multiple times within a folder or `uid` within the same Grafana instance to avoid inconsistent behavior.
{{< /admonition >}}

### Provision folders structure from filesystem to Grafana

If you already store your dashboards using folders in a Git repository or on a filesystem, and want to have the same folder names in the Grafana menu, use `foldersFromFilesStructure` option.

For example, to replicate the following dashboards structure from the filesystem to Grafana:

```
/etc/dashboards
├── /server
│   ├── /common_dashboard.json
│   └── /network_dashboard.json
└── /application
    ├── /requests_dashboard.json
    └── /resources_dashboard.json
```

use the following provisioning configuration file:

```yaml
apiVersion: 1

providers:
  - name: dashboards
    type: file
    updateIntervalSeconds: 30
    options:
      path: /etc/dashboards
      foldersFromFilesStructure: true
```

Grafana creates the `server` and `application` folders in the UI.

To use `foldersFromFilesStructure`, you must unset the `folder` and `folderUid` options.

To provision dashboards to the root level, store them in the root of your `path`.

{{< admonition type="note" >}}
This feature doesn't let you create nested folder structures, where you have folders within folders.
{{< /admonition >}}

## Alerting

For information on provisioning Grafana Alerting, refer to [Provision Grafana Alerting resources](../../alerting/set-up/provision-alerting-resources/).

### Supported settings

The following sections detail the supported settings and secure settings for each alert notification type.
In the provisioning YAML use `settings` for settings and `secure_settings` for secure settings.
Grafana encrypts secure settings in the database.

#### Alert notification `pushover`

| Name         | Secure setting |
| ------------ | -------------- |
| `apiToken`   | yes            |
| `userKey`    | yes            |
| `device`     |                |
| `priority`   |                |
| `okPriority` |                |
| `retry`      |                |
| `expire`     |                |
| `sound`      |                |
| `okSound`    |                |

#### Alert notification `discord`

| Name                   | Secure setting |
| ---------------------- | -------------- |
| `url`                  | yes            |
| `avatar_url`           |                |
| `content`              |                |
| `use_discord_username` |                |

#### Alert notification `slack`

| Name             | Secure setting |
| ---------------- | -------------- |
| `url`            | yes            |
| `recipient`      |                |
| `username`       |                |
| `icon_emoji`     |                |
| `icon_url`       |                |
| `uploadImage`    |                |
| `mentionUsers`   |                |
| `mentionGroups`  |                |
| `mentionChannel` |                |
| `token`          | yes            |
| `color`          |                |

#### Alert notification `victorops`

| Name          |
| ------------- |
| `url`         |
| `autoResolve` |

#### Alert notification `kafka`

| Name             |
| ---------------- |
| `kafkaRestProxy` |
| `kafkaTopic`     |

#### Alert notification `LINE`

| Name    | Secure setting |
| ------- | -------------- |
| `token` | yes            |

#### Alert notification `MQTT`

| Name            | Secure setting |
| --------------- | -------------- |
| `brokerUrl`     |                |
| `clientId`      |                |
| `topic`         |                |
| `messageFormat` |                |
| `username`      |                |
| `password`      | yes            |
| `retain`        |                |
| `qos`           |                |
| `tlsConfig`     |                |

##### TLS configuration

| Name                 | Secure setting |
| -------------------- | -------------- |
| `insecureSkipVerify` |                |
| `clientCertificate`  | yes            |
| `clientKey`          | yes            |
| `caCertificate`      | yes            |

#### Alert notification `pagerduty`

| Name             | Secure setting |
| ---------------- | -------------- |
| `integrationKey` | yes            |
| `autoResolve`    |                |

#### Alert notification `sensu`

| Name       | Secure setting |
| ---------- | -------------- |
| `url`      |                |
| `source`   |                |
| `handler`  |                |
| `username` |                |
| `password` | yes            |

#### Alert notification `sensugo`

| Name        | Secure setting |
| ----------- | -------------- |
| `url`       |                |
| `apikey`    | yes            |
| `entity`    |                |
| `check`     |                |
| `handler`   |                |
| `namespace` |                |

#### Alert notification `prometheus-alertmanager`

| Name                | Secure setting |
| ------------------- | -------------- |
| `url`               |                |
| `basicAuthUser`     |                |
| `basicAuthPassword` | yes            |

#### Alert notification `teams`

| Name  | Secure setting |
| ----- | -------------- |
| `url` |                |

#### Alert notification `dingding`

| Name  | Secure setting |
| ----- | -------------- |
| `url` |                |

#### Alert notification `email`

| Name          | Secure setting |
| ------------- | -------------- |
| `singleEmail` |                |
| `addresses`   |                |

#### Alert notification `hipchat`

| Name     | Secure setting |
| -------- | -------------- |
| `url`    |                |
| `apikey` |                |
| `roomid` |                |

#### Alert notification `opsgenie`

| Name               | Secure setting |
| ------------------ | -------------- |
| `apiKey`           | yes            |
| `apiUrl`           |                |
| `autoClose`        |                |
| `overridePriority` |                |
| `sendTagsAs`       |                |

#### Alert notification `telegram`

| Name          | Secure setting |
| ------------- | -------------- |
| `bottoken`    | yes            |
| `chatid`      |                |
| `uploadImage` |                |

#### Alert notification `threema`

| Name           | Secure setting |
| -------------- | -------------- |
| `gateway_id`   |                |
| `recipient_id` |                |
| `api_secret`   | yes            |

#### Alert notification `webhook`

| Name          | Secure setting |
| ------------- | -------------- |
| `url`         |                |
| `http_method` |                |
| `username`    |                |
| `password`    | yes            |
| `tls_config`  |                |
| `hmac_config` |                |

##### TLS configuration

| Name                 | Secure setting |
| -------------------- | -------------- |
| `insecureSkipVerify` |                |
| `clientCertificate`  | yes            |
| `clientKey`          | yes            |
| `caCertificate`      | yes            |

##### HMAC signature configuration

| Name              | Secure setting |
| ----------------- | -------------- |
| `secret`          | yes            |
| `header`          |                |
| `timestampHeader` |                |

#### Alert notification `googlechat`

| Name  | Secure setting |
| ----- | -------------- |
| `url` |                |

#### Alert notification `Cisco Webex Teams`

| Name        | Secure setting |
| ----------- | -------------- |
| `message`   |                |
| `room_id`   |                |
| `api_url`   |                |
| `bot_token` | yes            |

## Grafana Enterprise

Grafana Enterprise supports:

- [Provisioning role-based access control with Grafana](../roles-and-permissions/access-control/rbac-grafana-provisioning/)
- [Provisioning role-based access control with Terraform](../roles-and-permissions/access-control/rbac-terraform-provisioning/)
