+++
title = "Time series dimensions"
description = "time series dimensions"
keywords = ["grafana", "intro", "guide", "concepts", "timeseries", "labels"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/timeseries-dimensions"]
[menu.docs]
name = "Time series dimensions"
identifier = "time_series_dimensions"
parent = "guides"
weight = 300
+++

# Time series dimensions

At the end of the ["Time series databases" section of "Introduction to time series"]({{< relref "timeseries.md#time-series-databases" >}}), the concept of _labels_, also called  _tags_, is introduced:

> Another feature of a TSDB is the ability to filter measurements using _tags_. Each data point is labeled with a tag that adds context information, such as where the measurement was taken. ...

With time series data, the data often contain more than a single series, and is a set of multiple time series. Many Grafana data sources support this type of data.

{{< docs-imagebox img="/img/docs/example_graph_multi_dim.png" class="docs-image--no-shadow" max-width="850px" >}}

The common case is issuing a single query for a measurement with one or more additional properties as dimensions. For example, querying a temperature measurement along with a location property. In this case, multiple series are returned back from that single query and each series has unique location as a dimension.

To identify unique series within a set of time series, Grafana stores dimensions in _labels_.

## Labels

Each time series in Grafana optionally has labels. labels are set a of key/value pairs for identifying dimensions. Example labels could are `{location=us}` or `{country=us,state=ma,city=boston}`. Within a set of time series, the combination of its name and labels identifies each series. For example, `temperature {country=us,state=ma,city=boston}`.

Different sources of time series data have dimensions stored natively, or common storage patterns that allow the data to be extracted into dimensions.

Time series databases (TSDBs) usually natively support dimensionality. Prometheus also stores dimensions in _labels_. In TSDBs such as Graphite or OpenTSDB the term _tags_ is used instead.

In table databases such SQL, these dimensions are generally the `GROUP BY` parameters of a query.

## Multiple dimensions in table format

In SQL or SQL-like databases that return table responses, additional dimensions usually columns in the query response table.

### Single dimension

For example, consider a query like:

```sql
SELECT BUCKET(StartTime, 1h), AVG(Temperature) AS Temp, Location FROM T
  GROUP BY BUCKET(StartTime, 1h), Location
  ORDER BY time asc
```

Might return a table with three columns that each respectively have data types time, number, and string.

| StartTime  | Temp | Location |
| ---------- | ---- | -------- |
| 09:00      | 24   | LGA      |
| 09:00      | 20   | BOS      |
| 10:00      | 26   | LGA      |
| 10:00      | 22   | BOS      |

The table format is _long_ formatted time series, also called _tall_. It has repeated time stamps, and repeated values in Location. In this case, we have two time series in the set that would be identified as `Temp {Location=LGA}` and `Temp {Location=BOS}`.

Individual time series from the set are extracted by using the time typed column `StartTime` as the time index of the time series, the numeric typed column `Temp` as the series name, and the name and values of the string typed `Location` column to build the labels, such as Location=LGA.

### Multiple dimensions

If the query is updated to select and group by more than just one string column, for example, `GROUP BY BUCKET(StartTime, 1h), Location, Sensor`, then an additional dimension is added:

| StartTime  | Temp | Location | Sensor |
| ---------- | ---- | -------- | ------ |
| 09:00      | 24   | LGA      | A      |
| 09:00      | 24.1 | LGA      | B      |
| 09:00      | 20   | BOS      | A      |
| 09:00      | 20.2 | BOS      | B      |
| 10:00      | 26   | LGA      | A      |
| 10:00      | 26.1 | LGA      | B      |
| 10:00      | 22   | BOS      | A      |
| 10:00      | 22.2 | BOS      | B      |

In this case the labels that represent the dimensions will have two keys based on the two string typed columns `Location` and `Sensor`. This data results four series: `Temp {Location=LGA,Sensor=A}`, `Temp {Location=LGA,Sensor=B}`, `Temp {Location=BOS,Sensor=A}`, and `Temp {Location=BOS,Sensor=B}`.

**Note:** More than one dimension for SQL data sources is currently only supported in the Analytics services with the Azure monitor service as of version 7.1. Support for SQL data sources such as MySQL, Postgres, and MSSQL is planned to be added for 7.2.

**Note:** Multiple dimensions are not supported in a way that maps to multiple alerts in Grafana, but rather they are treated as multiple conditions to a single alert. See the documentation on [creating alerts with multiple series]({{< relref "../alerting/create-alerts.md#multiple-series" >}}).

### Multiple values

In the case SQL-like data sources, more than one numeric column can be selected, without or without additional string columns to be used as dimensions. For example, ` AVG(Temperature) AS AvgTemp,  MAX(Temperature) AS MaxTemp`. This, if combined with multiple dimensions can result in a lot of series. Selecting multiple values is currently only designed to be used with visualization.

Additional technical information on tabular time series formats and how dimensions are extracted can be found in [the developer documentation on data frames as time series]({{< relref "../developers/plugins/data-frames.md#data-frames-as-time-series" >}}).
