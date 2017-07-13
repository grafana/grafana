+++
title = "TestData"
keywords = ["grafana", "dashboard", "documentation", "panels", "testdata"]
type = "docs"
[menu.docs]
name = "TestData"
parent = "datasources"
weight = 20
+++


# Grafana TestData

The purpose of this data sources is to make it easier to create fake data for any panel.
Using `Grafana TestData` you can build your own time series and have any panel render it.
This make is much easier to verify functionally since the data can be shared very easily.

## Enable

`Grafana TestData` is not enabled by default. To enable it you have to go to `/plugins/testdata/edit` and click the enable button to enable.

## Create mock data.

Once `Grafana TestData` is enabled you can use it as a data source in any metric panel.

![](/img/docs/v41/test_data_add.png)

## CSV

The comma separated values scenario is the most powerful one since it lets you create any kind of graph you like.
Once you provided the numbers `Grafana TestData` will distribute them evenly based on the time range of your query.

![](/img/docs/v41/test_data_csv_example.png)

## Dashboards

`Grafana TestData` also contains some dashboards with example. `/plugins/testdata/edit`

### Commit updates to the dashboards

If you want to submit a change to one of the current dashboards bundled with `Grafana TestData` you have to update the revision property.
Otherwise the dashboard will not be updated automatically for other Grafana users.

## Using test data in issues

If you post an issue on github regarding time series data or rendering of time series data we strongly advice you to use this data source to replicate the data.
That makes it much easier for the developers to replicate and solve the issue you have.
