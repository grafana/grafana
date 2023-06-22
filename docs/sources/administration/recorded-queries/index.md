---
aliases:
  - ../enterprise/recorded-queries/
description: Grafana Enterprise recorded queries
keywords:
  - grafana
  - query
  - queries
  - recorded
title: Recorded queries
weight: 300
---

# Recorded queries

Recorded queries allow you to see trends over time by taking a snapshot of a data point on a set interval. This can give you insight into historic trends.

For our plugins that do not return time series, it might be useful to plot historical data. For example, you might want to query ServiceNow to see a history of request response times but it can only return current point-in-time metrics.

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}).
{{% /admonition %}}

## How recorded queries work

{{% admonition type="note" %}}
An administrator must configure a Prometheus data source and associate it with a [Remote write target](#remote-write-target) before recorded queries can be used.
{{% /admonition %}}

Recorded queries only work with backend data source plugins. Refer to [Backend data source plugin](/tutorials/build-a-data-source-backend-plugin/) for more information about backend data source plugins. You can recorded three types of queries:

- single row and column - A query that returns a single row and column.
- row count - A query that returns meaningful rows to be counted.
- expression - Any expression. To learn more about creating and using expressions, see [Write expression queries]({{< relref "../../panels-visualizations/query-transform-data/expression-queries" >}}).

After a recorded query is created or enabled, it immediately creates a snapshot and continues to create snapshots at the set interval. The recorded query stops taking snapshots when it is disabled, deleted, or when Grafana is not running. Data points are gathered in the backend by running the recorded query and forwarding each result to a remote-write enabled Prometheus instance.

## Using a recorded query

To use a recorded query, create one and add it to a dashboard. After that, it can be managed in **Preferences** from the **Recorded queries** tab.

### Create a recorded query

1.  Find/create a query you want to record on a dashboard in an edit panel. The query must only return one row and column. If it returns more, you can still record the number of results returned using the “count” option.
    - The query's data source must be a backend data source.
    - Expressions can be used to aggregate data from a time series query. Refer to [Write expression queries]({{< relref "../../panels-visualizations/query-transform-data/expression-queries" >}}) to learn more about creating and using expressions.
1.  Click the record query button located in the top right of the query editor.
1.  Enter recorded query information. All fields are required unless otherwise indicated.
    - Name - Name of the recorded query.
    - Description - (optional) Describe the recorded query as you want it to appear in the recorded query list.
    - Interval - The interval on which the snapshot will be taken. The interval starts when you create the recorded query and will stop if you pause or delete the recorded query. Refer to [Managing recorded queries](#manage-recorded-queries) for more information on pausing and deleting recorded queries.
    - Range - The relative time range of the query. If you select a range of `30m` and an interval of `1h` the query will take a snapshot every hour of the past 30 minutes.
    - Count query results - If you want to count the rows returned from your query toggle this option on. If this option is off, your query must return one row with one value.
1.  Test your recorded query by clicking the test recorded query button.
1.  Click `Start recording query` to start recording your query.

### Add a recorded query

You can add existing recorded queries to panels in a dashboard. For each recorded query that you add, a Prometheus query is created: `generated_recorded_query_name{id="generated_id", name="recorded query name"}`. The created query from Prometheus returns all the recorded query’s gathered snapshots.

1. Navigate to a panel in a dashboard where you wish to add a recorded query.
1. Click the `+ Recorded query` button located below the queries.
1. If you want to filter recorded queries by data source, select a data source from the filter by data source drop down menu.
1. Click the `Add` button on your recorded query to add it to the panel.

After adding your recorded query to the panel, the panel data source will become `-- Mixed --`. Your recorded query is represented by a `Prometheus` query with a name label matching your recorded query name. Refer to [Prometheus]({{< relref "../../datasources/prometheus/" >}}) to learn more about the `Prometheus` data source.

If after adding a recorded query, a query with a `-- Mixed --` data source instead of `Prometheus` data source appears, this could mean that a Prometheus remote write target was not set up for recorded queries. Refer to [Remote write target](#remote-write-target) to set up a remote write point.

### Manage recorded queries

Recorded queries can be paused/activated and deleted from the Recorded queries tab in Preferences. Deleting a recorded query will remove it from Grafana, but the information that was gathered in Prometheus will still be there. Pausing a recorded query will no longer gather new data points until it is resumed.

### Remote write target

The remote write target is the Prometheus data source that recorded query data points are written to. You will need a Prometheus with remote write enabled and you will need to create a data source for this Prometheus.

The remote write target can be edited by clicking `Edit Remote Write Target` in the upper right on the Recorded Queries tab in Preferences. Select the Prometheus data source that has remote write enabled and enter the remote write path.
