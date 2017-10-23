+++
title = "Datasource provisioning"
description = ""
keywords = ["grafana", "provisioning", "datasources"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++

# Provisioning Grafana

## Datasources 

> This feature is available from v4.7

It’s possible to manage datasources i Grafana with the `conf/datasources.yaml` configuration file. Any datasource available in this config file will be added to the database.
If the datasource already exist Grafana will update it to match the configuration file. You can also configure grafana to delete datasources that are not listed in the config by setting `purge_other_datasources` to true which is disabled by default. 

### Running multiple grafana instances.
If you are running multiple instances of Grafana you might get into problems if they have different versions of the datasource.yaml configuration file. The best way to solve this problem is to add a version number to each datasource in the configuration and increase it when you update the config. Grafana will only update datasources with the same or higher version number as specified in the config. That way old configs cannot overwrite newer configs if they restart at the same time. Its also recommended to not use purge_other_datasources when running multiple instances since instances with old configs might delete datasources created by new configs. 