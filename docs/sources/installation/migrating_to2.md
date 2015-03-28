---
page_title: Migrating from v1.x to 2.x
page_description: Migration guide for Grafana v1.x to v2.x
page_keywords: grafana, installation, migration, documentation
---

# Migrating from v1.x to v2.x

Grafana 2.0 represents a major update to Grafana. It brings new capabilities, many of which are enabled by its new backend server and integrated database.

The new backend lays a solid foundation that we hope to build on over the coming months. For the 2.0 release, it enables authentication as well as server-side sharing and rendering. 

We've attempted to provide a smooth migration path for V1.9 users to migrate to Grafana 2.0. 

## Adding Data sources

The config.js file has been deprecated. Data sources are now managed via the UI or [HTTP API](../reference/http_api.md). Manage your organizations data sources by clicking on the `Data Sources` menu on the side menu (which can be toggled via the Grafana icon in the upper left of your browser).

From here, you can add any Graphite, InfluxDB, elasticsearch, and OpenTSDB datasources that you were using with Grafana 1.x. Grafana 2.0 can be configured to communicate with your datasource using a backend mode which can eliminate many CORS-related issues, as well as provide more secure authentication to your datasources.

## Importing your existing dashboards

Grafana 2.0 now has integrated dashboard storage engine that can be configured to use an internal sqlite database, MySQL, or Postgres. This eliminates the need to use Elasticsearch for dashboard storage for Graphite users. Grafana 2.0 does not support storing dashboards in InfluxDB. 

You can seamlessly import your existing dashboards.

### dashboards from Elasticsearch

Start by going to the `Data Sources` view (via the side menu), and make sure your elasticsearch datasource is added. Specify the elasticsearch index name where your existing Grafana v1.x dashboards are stored (default is `grafana-dash`).

![](/img/v2/datasource_edit_elastic.jpg)

### dashboards from InfluxDB

Start by going to the `Data Sources` view (via the side menu), and make sure your InfluxDB datasource is added. Specify the database name where your Grafana v1.x dashboards are stored, default is `grafana`.

### Go to Import dashboards view

Go to the `Dashboards` view and click on the dashboards search dropdown. Click the `Import` button at the bottom of the search dropdown.

![](/img/v2/dashboard_import.jpg)

### Import view

In the Import view you find the section `Migrate dashboards`. Pick the datasource you added (from elasticsearch or InfluxDB),
and click the `Import` button.

![](/img/v2/migrate_dashboards.jpg)

Your dashboards should be automatically imported into the Grafana 2.0 backend. 

Dashboards will no longer be stored in your previous elasticsearch or InfluxDB databases.

### Invite your team

Explain users and orgs.

### Enjoy the new features
