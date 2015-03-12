---
page_title: Migrating from v1.x to 2.x
page_description: Migration guide for Grafana v1.x to v2.x
page_keywords: grafana, installation, migration, documentation
---

# Migrating from v1.x to v2.x

Grafana 2.x is pretty different from v1.x in that Grafana 2.x has its own backend and its own
database to store dashboards and users in.

## Import dashboards

### From Elasticsearch
Start by going to the `Data Sources` view and add your elasticsearch datasource. Specify the elasticsearch
index name where your Grafana v1.x dashboards are stored, default is `grafana-dash`.

![](/img/v2/datasource_edit_elastic.jpg)


### From InfluxDB

Start by going to the `Data Sources` view and add your influxdb datasource. Specify the database
name where your Grafana v1.x dashboards are stored, default is `grafana`.


### Go to Import dashboards view

Go to the `Dashboards` view and click on the dashboards search dropdown. At the bottom of the search dropdown
you find the `Import` button.

![](/img/v2/dashboard_import.jpg)


### Import view

In the Import view you find the section `Migrate dashboards`. Pick the datasource you added (Elasticsearch or InfluxDB)
and click the `Import` button.

![](/img/v2/migrate_dashboards.jpg)


