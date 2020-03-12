+++
title = "Provisioning"
description = ""
keywords = ["grafana", "provisioning"]
type = "docs"
aliases = ["/docs/grafana/latest/installation/provisioning"]
[menu.docs]
parent = "admin"
weight = 8
+++

# Provisioning Grafana

In previous versions of Grafana, you could only use the API for provisioning data sources and dashboards. But that required the service to be running before you started creating dashboards and you also needed to set up credentials for the HTTP API. In v5.0 we decided to improve this experience by adding a new active provisioning system that uses config files. This will make GitOps more natural as data sources and dashboards can be defined via files that can be version controlled. We hope to extend this system to later add support for users, orgs and alerts as well.

## Config File

Check out the [configuration]({{< relref "../installation/configuration" >}}) page for more information on what you can configure in `grafana.ini`

### Config File Locations

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom configuration file path can be overridden using the `--config` parameter

> **Note.** If you have installed Grafana using the `deb` or `rpm`
> packages, then your configuration file is located at
> `/etc/grafana/grafana.ini`. This path is specified in the Grafana
> init.d script using `--config` file parameter.

### Using Environment Variables

It is possible to use environment variable interpolation in all 3 provisioning config types. Allowed syntax
is either `$ENV_VAR_NAME` or `${ENV_VAR_NAME}` and can be used only for values not for keys or bigger parts
of the configs. It is not available in the dashboards definition files just the dashboard provisioning
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

If you have a literal `$` in your value and want to avoid interpolation, `$$` can be used.

<hr />

## Configuration Management Tools

Currently we do not provide any scripts/manifests for configuring Grafana. Rather than spending time learning and creating scripts/manifests for each tool, we think our time is better spent making Grafana easier to provision. Therefore, we heavily relay on the expertise of the community.

Tool | Project
-----|------------
Puppet | [https://forge.puppet.com/puppet/grafana](https://forge.puppet.com/puppet/grafana)
Ansible | [https://github.com/cloudalchemy/ansible-grafana](https://github.com/cloudalchemy/ansible-grafana)
Chef | [https://github.com/JonathanTron/chef-grafana](https://github.com/JonathanTron/chef-grafana)
Saltstack | [https://github.com/salt-formulas/salt-formula-grafana](https://github.com/salt-formulas/salt-formula-grafana)
Jsonnet | [https://github.com/grafana/grafonnet-lib/](https://github.com/grafana/grafonnet-lib/)

## Datasources

> This feature is available from v5.0

It's possible to manage datasources in Grafana by adding one or more yaml config files in the [`provisioning/datasources`](/installation/configuration/#provisioning) directory. Each config file can contain a list of `datasources` that will be added or updated during start up. If the datasource already exists, Grafana will update it to match the configuration file. The config file can also contain a list of datasources that should be deleted. That list is called `deleteDatasources`. Grafana will delete datasources listed in `deleteDatasources` before inserting/updating those in the `datasource` list.

### Running Multiple Grafana Instances

If you are running multiple instances of Grafana you might run into problems if they have different versions of the `datasource.yaml` configuration file. The best way to solve this problem is to add a version number to each datasource in the configuration and increase it when you update the config. Grafana will only update datasources with the same or lower version number than specified in the config. That way, old configs cannot overwrite newer configs if they restart at the same time.

### Example Datasource Config File

```yaml
# config file version
apiVersion: 1

# list of datasources that should be deleted from the database
deleteDatasources:
  - name: Graphite
    orgId: 1

# list of datasources to insert/update depending
# what's available in the database
datasources:
  # <string, required> name of the datasource. Required
- name: Graphite
  # <string, required> datasource type. Required
  type: graphite
  # <string, required> access mode. proxy or direct (Server or Browser in the UI). Required
  access: proxy
  # <int> org id. will default to orgId 1 if not specified
  orgId: 1
  # <string> url
  url: http://localhost:8080
  # <string> Deprecated, use secureJsonData.password
  password:
  # <string> database user, if used
  user:
  # <string> database name, if used
  database:
  # <bool> enable/disable basic auth
  basicAuth:
  # <string> basic auth username
  basicAuthUser:
  # <string> Deprecated, use secureJsonData.basicAuthPassword
  basicAuthPassword:
  # <bool> enable/disable with credentials headers
  withCredentials:
  # <bool> mark as default datasource. Max one per org
  isDefault:
  # <map> fields that will be converted to json and stored in jsonData
  jsonData:
     graphiteVersion: "1.1"
     tlsAuth: true
     tlsAuthWithCACert: true
  # <string> json object of data that will be encrypted.
  secureJsonData:
    tlsCACert: "..."
    tlsClientCert: "..."
    tlsClientKey: "..."
    # <string> database password, if used
    password:
    # <string> basic auth password
    basicAuthPassword:
  version: 1
  # <bool> allow users to edit datasources from the UI.
  editable: false
```

#### Custom Settings per Datasource
Please refer to each datasource documentation for specific provisioning examples.

| Datasource | Misc |
| ---- | ---- |
| Elasticsearch | Elasticsearch uses the `database` property to configure the index for a datasource |

#### Json Data

Since not all datasources have the same configuration settings we only have the most common ones as fields. The rest should be stored as a json blob in the `jsonData` field. Here are the most common settings that the core datasources use.

| Name | Type | Datasource | Description |
| ---- | ---- | ---- | ---- |
| tlsAuth | boolean | *All* |  Enable TLS authentication using client cert configured in secure json data |
| tlsAuthWithCACert | boolean | *All* | Enable TLS authentication using CA cert |
| tlsSkipVerify | boolean | *All* | Controls whether a client verifies the server's certificate chain and host name. |
| graphiteVersion | string | Graphite |  Graphite version  |
| timeInterval | string | Prometheus, Elasticsearch, InfluxDB, MySQL, PostgreSQL and MSSQL | Lowest interval/step value that should be used for this data source |
| esVersion | number | Elasticsearch | Elasticsearch version as a number (2/5/56/60/70) |
| timeField | string | Elasticsearch | Which field that should be used as timestamp |
| interval | string | Elasticsearch | Index date time format. nil(No Pattern), 'Hourly', 'Daily', 'Weekly', 'Monthly' or 'Yearly' |
| logMessageField | string | Elasticsearch | Which field should be used as the log message |
| logLevelField | string | Elasticsearch | Which field should be used to indicate the priority of the log message |
| authType | string | Cloudwatch | Auth provider. keys/credentials/arn |
| assumeRoleArn | string | Cloudwatch | ARN of Assume Role |
| defaultRegion | string | Cloudwatch | AWS region |
| customMetricsNamespaces | string | Cloudwatch | Namespaces of Custom Metrics |
| tsdbVersion | string | OpenTSDB | Version |
| tsdbResolution | string | OpenTSDB | Resolution |
| sslmode | string | PostgreSQL | SSLmode. 'disable', 'require', 'verify-ca' or 'verify-full' |
| encrypt | string | MSSQL | Connection SSL encryption handling. 'disable', 'false' or 'true' |
| postgresVersion | number | PostgreSQL | Postgres version as a number (903/904/905/906/1000) meaning v9.3, v9.4, ..., v10 |
| timescaledb | boolean | PostgreSQL | Enable usage of TimescaleDB extension |
| maxOpenConns | number | MySQL, PostgreSQL and MSSQL | Maximum number of open connections to the database (Grafana v5.4+) |
| maxIdleConns | number | MySQL, PostgreSQL and MSSQL | Maximum number of connections in the idle connection pool (Grafana v5.4+) |
| connMaxLifetime | number | MySQL, PostgreSQL and MSSQL | Maximum amount of time in seconds a connection may be reused (Grafana v5.4+) |

#### Secure Json Data

`{"authType":"keys","defaultRegion":"us-west-2","timeField":"@timestamp"}`

Secure json data is a map of settings that will be encrypted with [secret key]({{< relref "../installation/configuration/#secret-key" >}}) from the Grafana config. The purpose of this is only to hide content from the users of the application. This should be used for storing TLS Cert and password that Grafana will append to the request on the server side. All of these settings are optional.

| Name | Type | Datasource | Description |
| ----| ---- | ---- | --- |
| tlsCACert | string | *All* |CA cert for out going requests |
| tlsClientCert | string | *All* |TLS Client cert for outgoing requests |
| tlsClientKey | string | *All* |TLS Client key for outgoing requests |
| password | string | *All* | password |
| basicAuthPassword | string | *All* | password for basic authentication |
| accessKey | string | Cloudwatch | Access key for connecting to Cloudwatch |
| secretKey | string | Cloudwatch | Secret key for connecting to Cloudwatch |

#### Custom HTTP headers for datasources
Datasources managed by Grafanas provisioning can be configured to add HTTP headers to all requests
going to that datasource. The header name is configured in the `jsonData` field and the header value should be
configured in `secureJsonData`.

```yaml
apiVersion: 1

datasources:
- name: Graphite
  jsonData:
    httpHeaderName1: "HeaderName"
    httpHeaderName2: "Authorization"
  secureJsonData:
    httpHeaderValue1: "HeaderValue"
    httpHeaderValue2: "Bearer XXXXXXXXX"
```

### Dashboards

It's possible to manage dashboards in Grafana by adding one or more yaml config files in the [`provisioning/dashboards`](/installation/configuration/#provisioning) directory. Each config file can contain a list of `dashboards providers` that will load dashboards into Grafana from the local filesystem.

The dashboard provider config file looks somewhat like this:

```yaml
apiVersion: 1

providers:
  # <string> an unique provider name
- name: 'a unique provider name'
  # <int> org id. will default to orgId 1 if not specified
  orgId: 1
  # <string, required> name of the dashboard folder. Required
  folder: ''
  # <string> folder UID. will be automatically generated if not specified
  folderUid: ''
  # <string, required> provider type. Required
  type: file
  # <bool> disable dashboard deletion
  disableDeletion: false
  # <bool> enable dashboard editing
  editable: true
  # <int> how often Grafana will scan for changed dashboards
  updateIntervalSeconds: 10
  # <bool> allow updating provisioned dashboards from the UI
  allowUiUpdates: false
  options:
    # <string, required> path to dashboard files on disk. Required
    path: /var/lib/grafana/dashboards
```

When Grafana starts, it will update/insert all dashboards available in the configured path. Then later on poll that path every **updateIntervalSeconds** and look for updated json files and update/insert those into the database.

#### Making changes to a provisioned dashboard
It's possible to make changes to a provisioned dashboard in the Grafana UI. However, it is not possible to automatically save the changes back to the provisioning source.
If `allowUiUpdates` is set to `true` and you make changes to a provisioned dashboard, you can `Save` the dashboard then changes will be persisted to the Grafana database.

> **Note.** 
> If a provisioned dashboard is saved from the UI and then later updated from the source, the dashboard stored in the database will always be overwritten. The `version` property in the JSON file will not affect this, even if it is lower than the existing dashboard.
> 
> If a provisioned dashboard is saved from the UI and the source is removed, the dashboard stored in the database will be deleted unless the configuration option `disableDeletion` is set to true.

If `allowUiUpdates` is configured to `false`, you are not able to make changes to a provisioned dashboard. When you click `Save`, Grafana brings up a *Cannot save provisioned dashboard* dialog. The screenshot below illustrates this behavior.

Grafana offers options to export the JSON definition of a dashboard. Either `Copy JSON to Clipboard` or `Save JSON to file` can help you synchronize your dashboard changes back to the provisioning source.

Note: The JSON definition in the input field when using `Copy JSON to Clipboard` or `Save JSON to file` will have the `id` field automatically removed to aid the provisioning workflow.
                                                                                                                                                                 
{{< docs-imagebox img="/img/docs/v51/provisioning_cannot_save_dashboard.png" max-width="500px" class="docs-image--no-shadow" >}}

### Reusable Dashboard URLs

If the dashboard in the json file contains an [uid](/reference/dashboard/#json-fields), Grafana will force insert/update on that uid. This allows you to migrate dashboards betweens Grafana instances and provisioning Grafana from configuration without breaking the URLs given since the new dashboard URL uses the uid as identifier.
When Grafana starts, it will update/insert all dashboards available in the configured folders. If you modify the file, the dashboard will also be updated.
By default Grafana will delete dashboards in the database if the file is removed. You can disable this behavior using the `disableDeletion` setting.

> **Note.** Provisioning allows you to overwrite existing dashboards
> which leads to problems if you re-use settings that are supposed to be unique.
> Be careful not to re-use the same `title` multiple times within a folder
> or `uid` within the same installation as this will cause weird behaviors.

## Alert Notification Channels

Alert Notification Channels can be provisioned by adding one or more yaml config files in the [`provisioning/notifiers`](/installation/configuration/#provisioning) directory.

Each config file can contain the following top-level fields:
- `notifiers`, a list of alert notifications that will be added or updated during start up. If the notification channel already exists, Grafana will update it to match the configuration file.
- `delete_notifiers`, a list of alert notifications to be deleted before before inserting/updating those in the `notifiers` list.

Provisioning looks up alert notifications by uid, and will update any existing notification with the provided uid.

By default, exporting a dashboard as JSON will use a sequential identifier to refer to alert notifications. The field `uid` can be optionally specified to specify a string identifier for the alert name.

```json
{
  ...
      "alert": {
        ...,
        "conditions": [...],
        "frequency": "24h",
        "noDataState": "ok",
        "notifications": [
           {"uid": "notifier1"},
           {"uid": "notifier2"},
        ]
      }
  ...
}
```

### Example Alert Notification Channels Config File

```yaml
notifiers:
  - name: notification-channel-1
    type: slack
    uid: notifier1
    # either
    org_id: 2
    # or
    org_name: Main Org.
    is_default: true
    send_reminder: true
    frequency: 1h
    disable_resolve_message: false
    # See `Supported Settings` section for settings supporter for each
    # alert notification type.
    settings:
      recipient: "XXX"
      token: "xoxb"
      uploadImage: true
      url: https://slack.com

delete_notifiers:
  - name: notification-channel-1
    uid: notifier1
    # either
    org_id: 2
    # or
    org_name: Main Org.
  - name: notification-channel-2
    # default org_id: 1
```

### Supported Settings

The following sections detail the supported settings for each alert notification type.

#### Alert notification `pushover`

| Name |
| ---- |
| apiToken |
| userKey |
| device |
| retry |
| expire |

#### Alert notification `slack`

| Name |
| ---- |
| url |
| recipient |
| username |
| icon_emoji |
| icon_url |
| uploadImage |
| mentionUsers |
| mentionGroups |
| mentionChannel |
| token |

#### Alert notification `victorops`

| Name |
| ---- |
| url |
| autoResolve |

#### Alert notification `kafka`

| Name |
| ---- |
| kafkaRestProxy |
| kafkaTopic |

#### Alert notification `LINE`

| Name |
| ---- |
| token |

#### Alert notification `pagerduty`

| Name |
| ---- |
| integrationKey |
| autoResolve |

#### Alert notification `sensu`

| Name |
| ---- |
| url |
| source |
| handler |
| username |
| password |

#### Alert notification `prometheus-alertmanager`

| Name |
| ---- |
| url |

#### Alert notification `teams`

| Name |
| ---- |
| url |

#### Alert notification `dingding`

| Name |
| ---- |
| url |

#### Alert notification `email`

| Name |
| ---- |
| addresses |

#### Alert notification `hipchat`

| Name |
| ---- |
| url |
| apikey |
| roomid |

#### Alert notification `opsgenie`

| Name |
| ---- |
| apiKey |
| apiUrl |
| autoClose |
| overridePriority |

#### Alert notification `telegram`

| Name |
| ---- |
| bottoken |
| chatid |
| uploadImage |

#### Alert notification `threema`

| Name |
| ---- |
| gateway_id |
| recipient_id |
| api_secret |

#### Alert notification `webhook`

| Name |
| ---- |
| url |
| username |
| password |

#### Alert notification `googlechat`

| Name |
| ---- |
| url |

