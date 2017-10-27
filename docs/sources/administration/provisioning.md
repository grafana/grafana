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

## Datasources 

> This feature is available from v4.7

It's possible to manage datasources in Grafana by adding one or more yaml config files in the [`conf/datasources`](/installation/configuration/#datasources) directory. Each config file can contain a list of `datasources` that will be added or updated during start up. If the datasource already exists, Grafana will update it to match the configuration file. The config file can also contain a list of datasources that should be deleted. That list is called `delete_datasources`. Grafana will delete datasources listed in `delete_datasources` before inserting/updating those in the `datasource` list.

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
  # <string> json data
  json_data: '{"graphiteVersion":"0.9"}'
  # <string> json object of data that will be encrypted in UI.
  secure_json_fields: ''
  # <int> including this value garantees that instance with old configs cannot
  #       overwrite your last change.
  version: 1
  # <bool> allow users to edit datasources from the UI.
  editable: true
```

