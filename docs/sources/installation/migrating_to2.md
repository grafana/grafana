---
page_title: Migrating from v1.x to 2.x
page_description: Migration guide for Grafana v1.x to v2.x
page_keywords: grafana, installation, migration, documentation
---

# Migrating from v1.x to v2.x

Grafana 2.x is pretty different from v1.x in that Grafana 2.x has its own backend and its own
database to store dashboards and users in.

## Adding Data sources

Data sources in Grafana v2.0 are no longer configured via the `config.js` file. That config file is no more.
You add data sources via UI or via the [HTTP API](../reference/http_api). Go the `Data Sources` view via the side menu.
The side menu can be toggled via the Grafana icon in the top header (to the right).

## Importing dashboards

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

