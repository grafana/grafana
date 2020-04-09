+++
title = "Introduction Dataframes"
description = "Guide to understanding Dataframes"
keywords = ["grafana", "dataframe", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/dataframe"]
[menu.docs]
name = "Dataframes"
identifier = "dataframes_guide"
parent = "guides"
weight = 350
+++

## Introduction to Dataframes

Dataframes are a new concept in Grafana 7.0 and they replace the "Time Series" and "Table" types in Grafana. Dataframes are a more generic structure that can hold different shapes of time series, tables, and other types.

A dataframe is a [Columnar oriented](https://en.wikipedia.org/wiki/Column-oriented_DBMS) table like structure, meaning it stores data by column and not by row.

With dataframes, each column is represented by a **Field**. So the essence of a dataframe is an Field array with additional properties. Those additional properties on a Field include Name, Labels (a.k.a (Tags)), Optional display data and the data type of the Field's values. There are also additional properties display and metadata properties on the Frame itself.

One restriction on dataframes is that all Fields in the frame must be of the same length to be a valid dataframe.

### When is a Dataframe a Time Series or a Table

Any valid dataframe can be a table. If you have a row oriented response from something, the rows need to be converted to column oriented structure.

Because the Fields of a dataframe each have a type, we can use the types of the Fields (the schema of the dataframe) to determine if it (or a collection of dataframes) can be time series. In the simplest case, if a Frame has a Time type Field and Number type Field then it can be a time series (the frame should be sorted by time ascending).

## Technical References

### Apache Arrow

The dataframe structure is inspired by and uses the [Apache Arrow Project](https://arrow.apache.org/). Javascript Dataframes use Arrow Tables as the underlying structure, and the backend Go code serializes its Frames in Arrow Tables for transmission.

### Javascript

The javascript implementation of dataframes is in the [`/src/dataframe` folder](https://github.com/grafana/grafana/tree/master/packages/grafana-data/src/dataframe) of the [`@grafana/data` package](https://github.com/grafana/grafana/tree/master/packages/grafana-data).

### Go

Documentation for the Go implementation of dataframes can be found in the [github.com/grafana/grafana-plugin-sdk-go/data package](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/data?tab=doc).
