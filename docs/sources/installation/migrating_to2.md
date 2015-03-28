---
page_title: Migrating from v1.x to 2.x
page_description: Migration guide for Grafana v1.x to v2.x
page_keywords: grafana, installation, migration, documentation
---

# Migrating from v1.x to v2.x

Grafana 2.0 represents a major update to Grafana. It brings new capabilities, many of which are enabled by its new backend and integrated database.

The new backend lays a foundation for many new capabilities that we hope to deliver on over the coming months. For Grafana 2.0, we've focused on user and organization management and server-side sharing and rendering. 

We've attempted to provide a smooth migration path for V1.9 users to migrate to Grafana 2.0. Details are below:

## Adding Data sources

The 'config.js' file has been deprecated. Data sources are now managed via the UI or [HTTP API](../reference/http_api.md). Go the `Data Sources` view via the side menu (which can be toggled via the Grafana icon in the upper left of your browser. 

Add any Graphite, InfluxDB, elasticsearch, and OpenTSDB datasources that you were using with Grafana 1.x. Grafana 2.0 can be configured to communicate with your datasource using a backend mode which can eliminate many CORS-related issues, as well as provide more secure authentication to your datasources.

## Importing dashboards

Grafana 2.0 now has integrated dashboard storage engine that can be configured to use an internal sqllite database, MySQL, or Postgres. This eliminates the need to use Elasticsearch for dashboard storage for Graphite users. Grafana 2.0 no longer supports storing dashboards in InfluxDB.

### From Elasticsearch

Start by going to the `Data Sources` view (via the side menu), and add your elasticsearch datasource. Specify the elasticsearch index name where your Grafana v1.x dashboards are stored (default is `grafana-dash`).

![](/img/v2/datasource_edit_elastic.jpg)

### From InfluxDB

Start by going to the `Data Sources` view (via the side menu), and add your influxdb datasource. Specify the database
name where your Grafana v1.x dashboards are stored, default is `grafana`.

### Go to Import dashboards view

Go to the `Dashboards` view and click on the dashboards search dropdown. Click the `Import` button at the bottom of the search dropdown.

![](/img/v2/dashboard_import.jpg)

### Import view

In the Import view you find the section `Migrate dashboards`. Pick the datasource you added (from elasticsearch or InfluxDB),
and click the `Import` button.

![](/img/v2/migrate_dashboards.jpg)

Your dashboards should be automatically imported into the Grafana 2.0 backend. Dashboards will no longer be stored in your previous elasticsearch or InfluxDB databases.

### Invite your team

Explain users and orgs.

### Enjoy the new features
