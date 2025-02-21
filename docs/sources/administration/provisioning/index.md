---
aliases:
  - ../installation/provisioning/
description: Describes provisioning settings for Grafana using configuration files.
keywords:
  - grafana
  - provisioning
labels:
  products:
    - enterprise
    - oss
title: Provision Grafana
weight: 600
---

# Provision Grafana

Grafana has an active provisioning system that uses configuration files.
This makes GitOps more natural since data sources and dashboards can be defined using files that can be version controlled.

## Configuration file

Refer to [Configuration]({{< relref "../../setup-grafana/configure-grafana/" >}}) for more information on what you can configure in `grafana.ini`.

### Configuration file locations

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom configuration file path can be overridden using the `--config` parameter

{{< admonition type="note" >}}
If you have installed Grafana using the `deb` or `rpm`
packages, then your configuration file is located at
`/etc/grafana/grafana.ini`. This path is specified in the Grafana
`init.d` script using the `--config` file parameter.
{{< /admonition >}}

### Environment variables

You can use environment variable interpolation in all three provisioning configuration types.
The allowed syntax is either `$ENV_VAR_NAME` or `${ENV_VAR_NAME}`, and it can be used only for values, not for keys or larger parts
of the configurations. If the environment variable value has a `$` (e.g. `Pa$sw0rd`), use the `$ENV_VAR_NAME` syntax to avoid double expansion.
It's not available in the dashboard's definition files, just the dashboard provisioning
configuration.

Example:

```yaml
datasources:
  - name: Graphite
    url: http://localhost:$PORT
    user: $USER
    secureJsonData:
      password: $PASSWORD
```

You can use `$$` if you have a literal `$` in your value and want to avoid interpolation.

## Configuration management tools

Currently, we don't provide any scripts or manifests for configuring Grafana.
Rather than spending time learning and creating scripts or manifests for each tool, we think our time is better spent making Grafana easier to provision.
Therefore, we heavily rely on the expertise of the community.

| Tool      | Project                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Puppet    | [https://forge.puppet.com/puppet/grafana](https://forge.puppet.com/puppet/grafana)                                              |
| Ansible   | [https://github.com/grafana/grafana-ansible-collection](https://github.com/grafana/grafana-ansible-collection)                  |
| Chef      | [https://github.com/sous-chefs/chef-grafana](https://github.com/sous-chefs/chef-grafana)                                        |
| Saltstack | [https://github.com/salt-formulas/salt-formula-grafana](https://github.com/salt-formulas/salt-formula-grafana)                  |
| Jsonnet   | [https://github.com/grafana/grafonnet-lib/](https://github.com/grafana/grafonnet-lib/)                                          |
| NixOS     | [services.grafana.provision module](https://github.com/NixOS/nixpkgs/blob/master/nixos/modules/services/monitoring/grafana.nix) |

## Data sources

You can manage data sources in Grafana by adding YAML configuration files in the [`provisioning/datasources`]({{< relref "../../setup-grafana/configure-grafana#provisioning" >}}) directory.
Each configuration file can contain a list of `datasources` to add or update during startup.
If the data source already exists, Grafana reconfigures it to match the provisioned configuration file.

The configuration file can also list data sources to automatically delete, called `deleteDatasources`.
Grafana deletes the data sources listed in `deleteDatasources` _before_ adding or updating those in the `datasources` list.

You can configure Grafana to automatically delete provisioned data sources when they're removed from the provisioning file.
To do so, add `prune: true` to the root of your data source provisioning file.
With this configuration, Grafana also removes the provisioned data sources if you remove the provisioning file entirely.

### Running multiple Grafana instances

If you run multiple instances of Grafana, add a version number to each data source in the configuration and increase it when you update the configuration.
Grafana updates only data sources with the same or lower version number than specified in the configuration.
This prevents old configurations from overwriting newer ones if you have different versions of the `datasource.yaml` file that don't define version numbers, and then restart instances at the same time.

### Example data source configuration file

This example provisions a [Graphite data source]({{< relref "../../datasources/graphite" >}}):

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

For provisioning examples of specific data sources, refer to that [data source's documentation]({{< relref "../../datasources" >}}).

#### JSON data

Not all data sources have the same configuration settings. Only the most common fields are included in examples.
To provision the rest of a data source's settings, include them as a JSON blob in the `jsonData` field.

Common settings in the [built-in core data sources]({{< relref "../../datasources#built-in-core-data-sources" >}}) include:

{{< admonition type="note" >}}
Data sources tagged with _HTTP\*_ communicate using the HTTP protocol, which includes all core data source plugins except MySQL, PostgreSQL, and MSSQL.
{{< /admonition >}}

| Name                          | Type    | Data source                                                      | Description                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tlsAuth                       | boolean | _HTTP\*_, MySQL                                                  | Enable TLS authentication using client cert configured in secure json data                                                                                                                                                                                                                    |
| tlsAuthWithCACert             | boolean | _HTTP\*_, MySQL, PostgreSQL                                      | Enable TLS authentication using CA cert                                                                                                                                                                                                                                                       |
| tlsSkipVerify                 | boolean | _HTTP\*_, MySQL, PostgreSQL, MSSQL                               | Controls whether a client verifies the server's certificate chain and host name.                                                                                                                                                                                                              |
| serverName                    | string  | _HTTP\*_, MSSQL                                                  | Optional. Controls the server name used for certificate common name/subject alternative name verification. Defaults to using the data source URL.                                                                                                                                             |
| timeout                       | string  | _HTTP\*_                                                         | Request timeout in seconds. Overrides dataproxy.timeout option                                                                                                                                                                                                                                |
| graphiteVersion               | string  | Graphite                                                         | Graphite version                                                                                                                                                                                                                                                                              |
| timeInterval                  | string  | Prometheus, Elasticsearch, InfluxDB, MySQL, PostgreSQL and MSSQL | Lowest interval/step value that should be used for this data source.                                                                                                                                                                                                                          |
| httpMode                      | string  | Influxdb                                                         | HTTP Method. 'GET', 'POST', defaults to GET                                                                                                                                                                                                                                                   |
| maxSeries                     | number  | Influxdb                                                         | Max number of series/tables that Grafana processes                                                                                                                                                                                                                                            |
| httpMethod                    | string  | Prometheus                                                       | HTTP Method. 'GET', 'POST', defaults to POST                                                                                                                                                                                                                                                  |
| customQueryParameters         | string  | Prometheus                                                       | Query parameters to add, as a URL-encoded string.                                                                                                                                                                                                                                             |
| manageAlerts                  | boolean | Prometheus and Loki                                              | Manage alerts via Alerting UI                                                                                                                                                                                                                                                                 |
| alertmanagerUid               | string  | Prometheus and Loki                                              | UID of Alert Manager that manages Alert for this data source.                                                                                                                                                                                                                                 |
| timeField                     | string  | Elasticsearch                                                    | Which field that should be used as timestamp                                                                                                                                                                                                                                                  |
| interval                      | string  | Elasticsearch                                                    | Index date time format. nil(No Pattern), 'Hourly', 'Daily', 'Weekly', 'Monthly' or 'Yearly'                                                                                                                                                                                                   |
| logMessageField               | string  | Elasticsearch                                                    | Which field should be used as the log message                                                                                                                                                                                                                                                 |
| logLevelField                 | string  | Elasticsearch                                                    | Which field should be used to indicate the priority of the log message                                                                                                                                                                                                                        |
| maxConcurrentShardRequests    | number  | Elasticsearch                                                    | Maximum number of concurrent shard requests that each sub-search request executes per node                                                                                                                                                                                                    |
| sigV4Auth                     | boolean | Elasticsearch and Prometheus                                     | Enable usage of SigV4                                                                                                                                                                                                                                                                         |
| sigV4AuthType                 | string  | Elasticsearch and Prometheus                                     | SigV4 auth provider. default/credentials/keys                                                                                                                                                                                                                                                 |
| sigV4ExternalId               | string  | Elasticsearch and Prometheus                                     | Optional SigV4 External ID                                                                                                                                                                                                                                                                    |
| sigV4AssumeRoleArn            | string  | Elasticsearch and Prometheus                                     | Optional SigV4 ARN role to assume                                                                                                                                                                                                                                                             |
| sigV4Region                   | string  | Elasticsearch and Prometheus                                     | SigV4 AWS region                                                                                                                                                                                                                                                                              |
| sigV4Profile                  | string  | Elasticsearch and Prometheus                                     | Optional SigV4 credentials profile                                                                                                                                                                                                                                                            |
| authType                      | string  | Cloudwatch                                                       | Auth provider. default/credentials/keys                                                                                                                                                                                                                                                       |
| externalId                    | string  | Cloudwatch                                                       | Optional External ID                                                                                                                                                                                                                                                                          |
| assumeRoleArn                 | string  | Cloudwatch                                                       | Optional ARN role to assume                                                                                                                                                                                                                                                                   |
| defaultRegion                 | string  | Cloudwatch                                                       | Optional default AWS region                                                                                                                                                                                                                                                                   |
| customMetricsNamespaces       | string  | Cloudwatch                                                       | Namespaces of Custom Metrics                                                                                                                                                                                                                                                                  |
| profile                       | string  | Cloudwatch                                                       | Optional credentials profile                                                                                                                                                                                                                                                                  |
| tsdbVersion                   | string  | OpenTSDB                                                         | Version                                                                                                                                                                                                                                                                                       |
| tsdbResolution                | string  | OpenTSDB                                                         | Resolution                                                                                                                                                                                                                                                                                    |
| sslmode                       | string  | PostgreSQL                                                       | SSLmode. 'disable', 'require', 'verify-ca' or 'verify-full'                                                                                                                                                                                                                                   |
| tlsConfigurationMethod        | string  | PostgreSQL                                                       | SSL Certificate configuration, either by 'file-path' or 'file-content'                                                                                                                                                                                                                        |
| sslRootCertFile               | string  | PostgreSQL, MSSQL                                                | SSL server root certificate file, must be readable by the Grafana user                                                                                                                                                                                                                        |
| sslCertFile                   | string  | PostgreSQL                                                       | SSL client certificate file, must be readable by the Grafana user                                                                                                                                                                                                                             |
| sslKeyFile                    | string  | PostgreSQL                                                       | SSL client key file, must be readable by _only_ the Grafana user                                                                                                                                                                                                                              |
| encrypt                       | string  | MSSQL                                                            | Determines SSL encryption handling. Options include: `disable` - data sent between client and server is not encrypted; `false` - data sent between client and server is not encrypted beyond the login packet; `true` - data sent between client and server is encrypted. Default is `false`. |
| postgresVersion               | number  | PostgreSQL                                                       | Postgres version as a number (903/904/905/906/1000) meaning v9.3, v9.4, ..., v10                                                                                                                                                                                                              |
| timescaledb                   | boolean | PostgreSQL                                                       | Enable usage of TimescaleDB extension                                                                                                                                                                                                                                                         |
| maxOpenConns                  | number  | MySQL, PostgreSQL and MSSQL                                      | Maximum number of open connections to the database                                                                                                                                                                                                                                            |
| maxIdleConns                  | number  | MySQL, PostgreSQL and MSSQL                                      | Maximum number of connections in the idle connection pool                                                                                                                                                                                                                                     |
| connMaxLifetime               | number  | MySQL, PostgreSQL and MSSQL                                      | Maximum amount of time in seconds a connection may be reused                                                                                                                                                                                                                                  |
| keepCookies                   | array   | _HTTP\*_                                                         | Cookies that needs to be passed along while communicating with data sources                                                                                                                                                                                                                   |
| prometheusVersion             | string  | Prometheus                                                       | The version of the Prometheus data source, such as `2.37.0`, `2.24.0`                                                                                                                                                                                                                         |
| prometheusType                | string  | Prometheus                                                       | Prometheus database type. Options are `Prometheus`, `Cortex`, `Mimir` or`Thanos`.                                                                                                                                                                                                             |
| cacheLevel                    | string  | Prometheus                                                       | Determines the duration of the browser cache. Valid values include: `Low`, `Medium`, `High`, and `None`. This field is configurable when you enable the `prometheusResourceBrowserCache` feature flag.                                                                                        |
| incrementalQuerying           | string  | Prometheus                                                       | Experimental: Turn on incremental querying to enhance dashboard reload performance with slow data sources                                                                                                                                                                                     |
| incrementalQueryOverlapWindow | string  | Prometheus                                                       | Experimental: Configure incremental query overlap window. Requires a valid duration string, i.e. `180s` or `15m` Default value is `10m` (10 minutes).                                                                                                                                         |
| disableRecordingRules         | boolean | Prometheus                                                       | Experimental: Turn off Prometheus recording rules                                                                                                                                                                                                                                             |
| implementation                | string  | AlertManager                                                     | The implementation of the AlertManager data source, such as `prometheus`, `cortex` or `mimir`                                                                                                                                                                                                 |
| handleGrafanaManagedAlerts    | boolean | AlertManager                                                     | When enabled, Grafana-managed alerts are sent to this Alertmanager                                                                                                                                                                                                                            |

For examples of specific data sources' JSON data, refer to that [data source's documentation]({{< relref "../../datasources" >}}).

#### Secure JSON Data

Secure JSON data is a map of settings that are encrypted with a [secret key]({{< relref "../../setup-grafana/configure-grafana#secret_key" >}}) from the Grafana configuration.
The encryption hides content from the users of the application.
This should be used for storing the TLS Cert and password that Grafana appends to the request on the server side.
All of these settings are optional.

{{< admonition type="note" >}}
The _HTTP\*_ tag denotes data sources that communicate using the HTTP protocol, including all core data source plugins except MySQL, PostgreSQL, and MS SQL.
{{< /admonition >}}

| Name              | Type   | Data source                        | Description                                                                                                                                                      |
| ----------------- | ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tlsCACert         | string | _HTTP\*_, MySQL, PostgreSQL        | CA cert for out going requests. You can point directly to your stored cert by using an environment variable following the `$__file{path/to/ca}` format.          |
| tlsClientCert     | string | _HTTP\*_, MySQL, PostgreSQL        | TLS Client cert for outgoing requests. You can point directly to your stored cert by using an environment variable following the `$__file{path/to/cert}` format. |
| tlsClientKey      | string | _HTTP\*_, MySQL, PostgreSQL        | TLS Client key for outgoing requests. You can point directly to your stored key by using an environment variable following the `$__file{path/to/key}` format.    |
| password          | string | _HTTP\*_, MySQL, PostgreSQL, MSSQL | password                                                                                                                                                         |
| basicAuthPassword | string | _HTTP\*_                           | password for basic authentication                                                                                                                                |
| accessKey         | string | Cloudwatch                         | Access key for connecting to Cloudwatch                                                                                                                          |
| secretKey         | string | Cloudwatch                         | Secret key for connecting to Cloudwatch                                                                                                                          |
| sigV4AccessKey    | string | Elasticsearch and Prometheus       | SigV4 access key. Required when using keys auth provider                                                                                                         |
| sigV4SecretKey    | string | Elasticsearch and Prometheus       | SigV4 secret key. Required when using keys auth provider                                                                                                         |

#### Custom HTTP headers for data sources

Data sources managed with provisioning can be configured to add HTTP headers to all requests.
Configure the header name in the `jsonData` field and the header value in `secureJsonData`.

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

You can manage plugin applications in Grafana by adding one or more YAML configuration files in the [`provisioning/plugins`]({{< relref "../../setup-grafana/configure-grafana#provisioning" >}}) directory.
Each configuration file can contain a list of `apps` that update during start up.
Grafana updates each app to match the configuration file.

{{< admonition type="note" >}}
This feature enables you to provision plugin configurations, not the plugins themselves.
The plugins must already be installed on the Grafana instance.
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

You can manage dashboards in Grafana by adding one or more YAML configuration files in the [`provisioning/dashboards`]({{< relref "../../setup-grafana/configure-grafana#dashboards" >}}) directory.
Each configuration file can contain a list of `dashboards providers` that load dashboards into Grafana from the local filesystem.

The dashboard provider configuration file looks somewhat like this:

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

When Grafana starts, it updates and inserts all dashboards available in the configured path.
Then later on, Grafana polls that path every **updateIntervalSeconds**, looks for updated JSON files, and updates and inserts those into the database.

> **Note:** Dashboards are provisioned to the root level if the `folder` option is missing or empty.

#### Making changes to a provisioned dashboard

While you can change a provisioned dashboard in the Grafana UI, those changes can't be saved back to the provisioning source.
If `allowUiUpdates` is set to `true` and you make changes to a provisioned dashboard, you can `Save` the dashboard, then changes persist to the Grafana database.

{{< admonition type="note" >}}
If a provisioned dashboard is saved from the UI and then later updated from the source, the dashboard stored in the database will always be overwritten. The `version` property in the JSON file won't affect this, even if it's lower than the version of the existing dashboard.

If a provisioned dashboard is saved from the UI and the source is removed, the dashboard stored in the database is deleted unless the configuration option `disableDeletion` is set to `true`.
{{< /admonition >}}

If `allowUiUpdates` is configured to `false`, you are not able to make changes to a provisioned dashboard. When you click `Save`, Grafana brings up a _Cannot save provisioned dashboard_ dialog. The screenshot below illustrates this behavior.

Grafana offers options to export the JSON definition of a dashboard. Either `Copy JSON to Clipboard` or `Save JSON to file` can help you synchronize your dashboard changes back to the provisioning source.

{{< admonition type="note" >}}
The JSON definition in the input field when using `Copy JSON to Clipboard` or `Save JSON to file` has the `id` field automatically removed to aid the provisioning workflow.
{{< /admonition >}}

{{< figure src="/static/img/docs/v51/provisioning_cannot_save_dashboard.png" max-width="500px" class="docs-image--no-shadow" >}}

### Reusable dashboard URLs

If the dashboard in the JSON file contains an [UID]({{< relref "../../dashboards/build-dashboards/view-dashboard-json-model" >}}), Grafana forces insert/update on that UID.
This allows you to migrate dashboards between Grafana instances and provisioning Grafana from configuration without breaking the URLs given because the new dashboard URL uses the UID as identifier.
When Grafana starts, it updates and inserts all dashboards available in the configured folders.
If you modify the file, then the dashboard is also updated.
By default, Grafana deletes dashboards in the database if the file is removed.
You can disable this behavior using the `disableDeletion` setting.

{{< admonition type="note" >}}
Provisioning allows you to overwrite existing dashboards
which leads to problems if you reuse settings that are supposed to be unique.
Be careful not to reuse the same `title` multiple times within a folder
or `uid` within the same installation as this causes weird behaviors.
{{< /admonition >}}

### Provision folders structure from filesystem to Grafana

If you already store your dashboards using folders in a git repo or on a filesystem, and also you want to have the same folder names in the Grafana menu, you can use `foldersFromFilesStructure` option.

For example, to replicate these dashboards structure from the filesystem to Grafana,

```
/etc/dashboards
├── /server
│   ├── /common_dashboard.json
│   └── /network_dashboard.json
└── /application
    ├── /requests_dashboard.json
    └── /resources_dashboard.json
```

You need to specify just this short provision configuration file.

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

In this example, `server` and `application` become new folders in the Grafana menu.

{{< admonition type="note" >}}
The `folder` and `folderUid` options should be empty or missing to make `foldersFromFilesStructure` work.

To provision dashboards to the root level, store them in the root of your `path`.

You can't create nested folders structures, where you have folders within folders.
{{< /admonition >}}

## Alerting

For information on provisioning Grafana Alerting, refer to [Provision Grafana Alerting resources]({{< relref "../../alerting/set-up/provision-alerting-resources/"  >}}).

### Supported settings

The following sections detail the supported settings and secure settings for each alert notification type. Secure settings are stored encrypted in the database and you add them to `secure_settings` in the YAML file instead of `settings`.

#### Alert notification `pushover`

| Name       | Secure setting |
| ---------- | -------------- |
| apiToken   | yes            |
| userKey    | yes            |
| device     |                |
| priority   |                |
| okPriority |                |
| retry      |                |
| expire     |                |
| sound      |                |
| okSound    |                |

#### Alert notification `discord`

| Name                 | Secure setting |
| -------------------- | -------------- |
| url                  | yes            |
| avatar_url           |                |
| content              |                |
| use_discord_username |                |

#### Alert notification `slack`

| Name           | Secure setting |
| -------------- | -------------- |
| url            | yes            |
| recipient      |                |
| username       |                |
| icon_emoji     |                |
| icon_url       |                |
| uploadImage    |                |
| mentionUsers   |                |
| mentionGroups  |                |
| mentionChannel |                |
| token          | yes            |
| color          |                |

#### Alert notification `victorops`

| Name        |
| ----------- |
| url         |
| autoResolve |

#### Alert notification `kafka`

| Name           |
| -------------- |
| kafkaRestProxy |
| kafkaTopic     |

#### Alert notification `LINE`

| Name  | Secure setting |
| ----- | -------------- |
| token | yes            |

#### Alert notification `MQTT`

| Name          | Secure setting |
| ------------- | -------------- |
| brokerUrl     |                |
| clientId      |                |
| topic         |                |
| messageFormat |                |
| username      |                |
| password      | yes            |
| retain        |                |
| qos           |                |
| tlsConfig     |                |

##### TLS config

| Name               | Secure setting |
| ------------------ | -------------- |
| insecureSkipVerify |                |
| clientCertificate  | yes            |
| clientKey          | yes            |
| caCertificate      | yes            |

#### Alert notification `pagerduty`

| Name           | Secure setting |
| -------------- | -------------- |
| integrationKey | yes            |
| autoResolve    |                |

#### Alert notification `sensu`

| Name     | Secure setting |
| -------- | -------------- |
| url      |                |
| source   |                |
| handler  |                |
| username |                |
| password | yes            |

#### Alert notification `sensugo`

| Name      | Secure setting |
| --------- | -------------- |
| url       |                |
| apikey    | yes            |
| entity    |                |
| check     |                |
| handler   |                |
| namespace |                |

#### Alert notification `prometheus-alertmanager`

| Name              | Secure setting |
| ----------------- | -------------- |
| url               |                |
| basicAuthUser     |                |
| basicAuthPassword | yes            |

#### Alert notification `teams`

| Name |
| ---- |
| url  |

#### Alert notification `dingding`

| Name |
| ---- |
| url  |

#### Alert notification `email`

| Name        |
| ----------- |
| singleEmail |
| addresses   |

#### Alert notification `hipchat`

| Name   |
| ------ |
| url    |
| apikey |
| roomid |

#### Alert notification `opsgenie`

| Name             | Secure setting |
| ---------------- | -------------- |
| apiKey           | yes            |
| apiUrl           |                |
| autoClose        |                |
| overridePriority |                |
| sendTagsAs       |                |

#### Alert notification `telegram`

| Name        | Secure setting |
| ----------- | -------------- |
| bottoken    | yes            |
| chatid      |                |
| uploadImage |                |

#### Alert notification `threema`

| Name         | Secure setting |
| ------------ | -------------- |
| gateway_id   |                |
| recipient_id |                |
| api_secret   | yes            |

#### Alert notification `webhook`

| Name        | Secure setting |
| ----------- | -------------- |
| url         |                |
| http_method |                |
| username    |                |
| password    | yes            |
| tls_config  |                |

##### TLS config

| Name               | Secure setting |
| ------------------ | -------------- |
| insecureSkipVerify |                |
| clientCertificate  | yes            |
| clientKey          | yes            |
| caCertificate      | yes            |

#### Alert notification `googlechat`

| Name |
| ---- |
| url  |

#### Alert notification `Cisco Webex Teams`

| Name      | Secure setting |
| --------- | -------------- |
| message   |                |
| room_id   |                |
| api_url   |                |
| bot_token | yes            |

## Grafana Enterprise

Grafana Enterprise supports:

- [Provisioning role-based access control with Grafana]({{< relref "../roles-and-permissions/access-control/rbac-grafana-provisioning/" >}})
- [Provisioning role-based access control with Terraform]({{< relref "../roles-and-permissions/access-control/rbac-terraform-provisioning/" >}})
