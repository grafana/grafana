+++
title = "Add a query"
weight = 30
+++

# Add a query

A query returns data that Grafana visualizes in dashboards. When you create a panel, Grafana automatically selects the default data source.

Before you begin:

- Add a data source.
- Ensure that you know the query language of the data source.
- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel/_index.md" >}}).

To add a query:

1. Edit the panel to which you are adding a query.
1. Click the **Query** tab.
1. Click the **Data source** drop-down menu and select a data source.
1. Click **Query options** to configure the maximum number of data points returned by the query and how frequently you want the query to request data from the data source.

   For more information about query options, refer to [Reference: Query options](../reference-query-options/_index.md).

1. Write the query.

   For more information about using the xx unique to the selected data source, refer to xxx

Query editors for:
MS SQL Server
CloudWatch
Azure - don't see in list
Google Cloud
Elastic
Graphite
Influx
Not Jaeger
Loki
MySQL
OpenTSDB
PostgreSQL
Prometheus
Not Tempo
Not Zipkin

1. Click **Apply**.

The system queries the data source and presents the data in the visualization.
