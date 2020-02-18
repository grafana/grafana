+++
title = "TestData"
keywords = ["grafana", "dashboard", "documentation", "panels", "testdata"]
type = "docs"
[menu.docs]
name = "TestData"
parent = "datasources"
weight = 20
+++


# Grafana TestData DB

The purpose of this data source is to make it easier to create fake data for any panel.
Using `TestData DB` you can build your own time series and have any panel render it.
This make is much easier to verify functionally since the data can be shared very easily.

## Enable

The `TestData DB` data source is not enabled by default. To enable it, first navigate to the *Data Source* section of the configuration menu. Click the *Add Data Source*, search for and select `TestData DB`. Finally, click *Save & Test* to enable it.

## Create mock data.

Once `TestData DB` is enabled you can use it as a data source in any metric panel.

![](/img/docs/v41/test_data_add.png)

## CSV

The comma separated values scenario is the most powerful one since it lets you create any kind of graph you like.
Once you provided the numbers `TestData DB` will distribute them evenly based on the time range of your query.

![](/img/docs/v41/test_data_csv_example.png)

## Dashboards

`TestData DB` also contains some dashboards with example. Click on *Configuration* > *Data Sources* > *TestData DB* > *Dashboards*, then import the "Simple Streaming Example" dashboard.

### Commit updates to the dashboards

If you want to submit a change to one of the current dashboards bundled with `TestData DB` you have to update the revision property.
Otherwise the dashboard will not be updated automatically for other Grafana users.

## Using test data in issues

If you post an issue on github regarding time series data or rendering of time series data we strongly advice you to use this data source to replicate the data.
That makes it much easier for the developers to replicate and solve the issue you have.
