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

A dataframe is a Columnar oriented table like structure...

### When is a Dataframe a Time Series or a Table

...

## Technical References

### Apache Arrow

The dataframe structure is inspired by and uses the [Apache Arrow Project](https://arrow.apache.org/). Javascript Dataframes use Arrow Tables as the underlying structure, and the backend Go code serializes its Frames in Arrow Tables for transmission.

### Javascript

The javascript implementation of dataframes is in the `/src/dataframe` folder of the [`@grafana/data` package](https://github.com/grafana/grafana/tree/master/packages/grafana-data)

### Go

Documentation for the Go implementation of dataframes can be found in the [github.com/grafana/grafana-plugin-sdk-go/data package](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/data?tab=doc).
