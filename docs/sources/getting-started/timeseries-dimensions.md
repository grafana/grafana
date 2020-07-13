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

In at the end of the [Time series databases section of "Introduction to time series"](TODO://link) the concepts of tags is introduced:

> Another feature of a TSDB is the ability to filter measurements using _tags_. Each data point is labeled with a tag that adds context information, such as where the measurement was taken. ...

**TODO**: Look at glossary, labels/tags, maybe update quote and original document above to labels.

**TODO**: Example of data, table probably.

With time series data, the data often contains more than a single series and is a set of multiple time series. Many Grafana data sources support this type of data. The common case is issuing a single query for a measurement such as temperature as well an requesting an additional property such as location. In this case multiple series are returned back from that single query as a set, where each series in this case has unique location. To uniquely identify these series, Grafana stores this information in _Labels_.

## Labels


How dimensions are stored as Labels

Other terms:
Tags, Dimensions, Group By, Split on, Factor, Categorical Value

Dimension examples from TSDBs.

## Multiple-Dimensions in Table Format

SQL, spreadsheets
