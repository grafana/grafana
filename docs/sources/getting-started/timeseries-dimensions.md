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

In at the end of the ["Time series databases" section of "Introduction to time series"]({{< relref "timeseries.md#time-series-databases" >}}) the concept of Labels (a.k.a tags) is introduced:

> Another feature of a TSDB is the ability to filter measurements using _tags_. Each data point is labeled with a tag that adds context information, such as where the measurement was taken. ...

With time series data, the data often contains more than a single series, and is a set of multiple time series. Many Grafana data sources support this type of data.

The common case is issuing a single query for a measurement, such as temperature, as well as requesting an additional property such as the location of the measurement. In this case, multiple series are returned back from that single query. Each series in this case has unique location. To uniquely identify these series within a set of time series, Grafana stores this information in _Labels_.

## Labels

Each time series in Grafana optionally has Labels. Labels are set a of key/value pairs for identifying dimensions. Example Labels could are `{location=us}` or `{country=us,state=ma,city=boston}`. Within a set of time series, the combination of its name and labels identifies each series. For example, `temperature {country=us,state=ma,city=boston}`.

Different sources of time series data have dimensions stored natively, or common storage patterns that allow the data to be extracted into dimensions. Time series databases (TSDBs) usually natively support dimensionality. In TSDBs such as Graphite or OpenTSDB the term _Tags_ is used - in Prometheus the same term as used as in Grafana - _Labels_. In table databases such SQL, these dimensions are generally the `GROUP BY` parameters of a query.

By storing dimensionality as Labels for time series in Grafana it allows for the possibility of data transformations and alerting to also support multiple dimensions.

## Multiple dimensions in table format

In SQL or SQL-like databases that return table responses, additional dimensions are generally found as columns in the table that is returned as a response from the query.

### Single dimension

For example, consider a pseudo query like:

```sql
SELECT BUCKET(StartTime, 1h), AVG(Temperature) AS Temp, Location FROM T
  GROUP BY BUCKET(StartTime, 1h), Location
  ORDER BY time asc
```

Might return a table like with a 3 columns that each respectively have a type of Time, Number, and String:

| StartTime  | Temp | Location |
| ---------- | ---- | -------- |
| 09:00      | 24   | LGA      |
| 09:00      | 20   | BOS      |
| 10:00      | 26   | LGA      |
| 10:00      | 22   | BOS      |


The table format is _Long_ formatted time series (aka Tall). It has repeated time stamps, and repeated values in Location. In this case, we have two time series in the set that would be identified as `Temp {Location=LGA}` and `Temp {Location=BOS}`.

Individual time series from the set are extracted by using the time typed column `StartTime` as the time index of the time series, the numeric typed column `Temp` as the series Name, and the name and values of the string typed `Location` column to build the labels, such as Location=LGA.

### Multiple dimensions

**TODO**: Azure only As 7.1, SQL coming in 7.2

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

In this case the Labels that represent the dimensions will have two keys based on the two string typed columns `Location` and `Sensor`. This data results four series: `Temp {Location=LGA,Sensor=A}`, `Temp {Location=LGA,Sensor=B}`, `Temp {Location=BOS,Sensor=A}`, and `Temp {Location=BOS,Sensor=B}`.
