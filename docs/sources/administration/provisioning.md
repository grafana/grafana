+++
title = "Provisioning"
description = ""
keywords = ["grafana", "provisioning"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++

# Provisioning Grafana

## Config file

Checkout the [configuration](/installation/configuration) page for more information about what you can configure in `grafana.ini`

### Config file locations

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`
- The custom configuration file path can be overridden using the `--config` parameter

> **Note.** If you have installed Grafana using the `deb` or `rpm`
> packages, then your configuration file is located at
> `/etc/grafana/grafana.ini`. This path is specified in the Grafana
> init.d script using `--config` file parameter.

### Using environment variables

All options in the configuration file (listed below) can be overridden
using environment variables using the syntax:

```bash
GF_<SectionName>_<KeyName>
```

Where the section name is the text within the brackets. Everything
should be upper case, `.` should be replaced by `_`. For example, given these configuration settings:

```bash
# default section
instance_name = ${HOSTNAME}

[security]
admin_user = admin

[auth.google]
client_secret = 0ldS3cretKey
```

Then you can override them using:

```bash
export GF_DEFAULT_INSTANCE_NAME=my-instance
export GF_SECURITY_ADMIN_USER=true
export GF_AUTH_GOOGLE_CLIENT_SECRET=newS3cretKey
```

<hr />

## Configuration management tools

Currently we do not provide any scripts/manifests for configuring Grafana. Rather then spending time learning and creating scripts/manifests for each tool, we think our time is better spent making Grafana easier to provision. Therefor, we heavily relay on the expertise of he community. 

Tool | Project
-----|------------
Puppet | [https://forge.puppet.com/puppet/grafana](https://forge.puppet.com/puppet/grafana)
Ansible | [https://github.com/cloudalchemy/ansible-grafana](https://github.com/cloudalchemy/ansible-grafana)
Ansible | [https://github.com/picotrading/ansible-grafana](https://github.com/picotrading/ansible-grafana)
Chef | [https://github.com/JonathanTron/chef-grafana](https://github.com/JonathanTron/chef-grafana)
Saltstack | [https://github.com/salt-formulas/salt-formula-grafana](https://github.com/salt-formulas/salt-formula-grafana)

## Datasources 

> This feature is available from v5.0

It's possible to manage datasources in Grafana by adding one or more yaml config files in the [`provisioning/datasources`](/installation/configuration/#provisioning) directory. Each config file can contain a list of `datasources` that will be added or updated during start up. If the datasource already exists, Grafana will update it to match the configuration file. The config file can also contain a list of datasources that should be deleted. That list is called `delete_datasources`. Grafana will delete datasources listed in `delete_datasources` before inserting/updating those in the `datasource` list.

### Running multiple grafana instances.
If you are running multiple instances of Grafana you might run into problems if they have different versions of the datasource.yaml configuration file. The best way to solve this problem is to add a version number to each datasource in the configuration and increase it when you update the config. Grafana will only update datasources with the same or lower version number than specified in the config. That way old configs cannot overwrite newer configs if they restart at the same time. 

### Example datasource config file
```yaml
# list of datasources that should be deleted from the database
delete_datasources:
  - name: Graphite
    org_id: 1

# list of datasources to insert/update depending 
# whats available in the datbase
datasources:
  # <string, required> name of the datasource. Required
- name: Graphite
  # <string, required> datasource type. Required
  type: graphite
  # <string, required> access mode. direct or proxy. Required
  access: proxy
  # <int> org id. will default to org_id 1 if not specified
  org_id: 1
  # <string> url
  url: http://localhost:8080
  # <string> database password, if used
  password:
  # <string> database user, if used
  user:
  # <string> database name, if used
  database:
  # <bool> enable/disable basic auth
  basic_auth:
  # <string> basic auth username
  basic_auth_user:
  # <string> basic auth password
  basic_auth_password:
  # <bool> enable/disable with credentials headers
  with_credentials:
  # <bool> mark as default datasource. Max one per org
  is_default:
  # <map> fields that will be converted to json and stored in json_data
  json_data: 
     graphiteVersion: "1.1"
     tlsAuth: true
     tlsAuthWithCACert: true
  # <string> json object of data that will be encrypted.
  secure_json_data:
    tlsCACert: "..."
    tlsClientCert: "..."
    tlsClientKey: "..."
  version: 1
  # <bool> allow users to edit datasources from the UI.
  editable: false
```

#### Json data

Since all datasources dont have the same configuration settings we only have the most common ones as fields. The rest should be stored as a json blob in the `json_data` field. Here are the most common settings that the core datasources use. 

| Name | Type | Datasource |Description |
| ----| ---- | ---- | --- |
| tlsAuth | boolean | *All* |  Enable TLS authentication using client cert configured in secure json data |
| tlsAuthWithCACert | boolean | *All* | Enable TLS authtication using CA cert |
| graphiteVersion | string | Graphite |  Graphite version  |
| timeInterval | string | Elastic, Influxdb & Prometheus | Lowest interval/step value that should be used for this data source |
| esVersion | string | Elastic | Elasticsearch version | 
| timeField | string | Elastic | Which field that should be used as timestamp | 
| interval | string | Elastic | Index date time format |
| authType | string | Cloudwatch | Auth provider. keys/credentials/arn |
| assumeRoleArn | string | Cloudwatch | ARN of Assume Role | 
| defaultRegion | string | Cloudwatch | AWS region |
| customMetricsNamespaces | string | Cloudwatch | Namespaces of Custom Metrics | 
| tsdbVersion | string | OpenTsdb | Version |
| tsdbResolution | string | OpenTsdb | Resolution |
| sslmode | string | Postgre | SSLmode. 'disable', 'require', 'verify-ca' or 'verify-full' | 


#### Secure Json data

{"authType":"keys","defaultRegion":"us-west-2","timeField":"@timestamp"}

Secure json data is a map of settings that will be encrypted with [secret key](/installation/configuration/#secret-key) from the grafana config. The purpose of this is only to hide content from the users of the application. This should be used for storing TLS Cert and password that Grafana will append to request on the server side. All these settings are optional.

| Name | Type | Datasource | Description |
| ----| ---- | ---- | --- |
| tlsCACert | string | *All* |CA cert for out going requests |
| tlsClientCert | string | *All* |TLS Client cert for outgoing requests |
| tlsClientKey | string | *All* |TLS Client key for outgoing requests |
| password | string | Postgre | password | 
| user | string | Postgre | user | 

### Dashboards

It's possible to manage dashboards in Grafana by adding one or more yaml config files in the [`provisioning/dashboards`](/installation/configuration/#provisioning) directory. Each config file can contain a list of `dashboards providers` that will load dashboards into grafana. Currently we only support reading dashboards from file but we will add more providers in the future. 

The dashboard provider config file looks like this

```yaml
- name: 'default'
  org_id: 1
  folder: ''
  type: file
  options:
    folder: /var/lib/grafana/dashboards
```

When grafana starts it will update/insert all dashboards available in the configured folders. If you modify the file the dashboard will also be updated. 