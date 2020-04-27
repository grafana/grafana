+++
title = "Introduction Data frames"
type = "docs"
[menu.docs]
name = "Data frames"
parent = "developing"
weight = 9
draft = true
+++

## Introduction to data frames

Data frames were introduced in Grafana 7.0. They replace the Time Series and Table types in Grafana. Data frames are a more generic structure that can hold different shapes of time series, tables, and other types.

A data frame is a [Columnar oriented](https://en.wikipedia.org/wiki/Column-oriented_DBMS) table structure, meaning it stores data by column and not by row.

**Simplified data frame model:**

```ts
interface DataFrame {
    name?:  string;
    // reference to query that create the frame
    refId?: string;

    fields: []Field;
}
```

```ts
interface Field {
    name:    string;
     // Prometheus like Labels / Tags
    labels?: Record<string, string>;

    // For example string, number, time (or more specific primitives in the backend)
    type:   FieldType;
    // Array of values all of the same type
    values: Vector<T>;

    // Optional display data for the field (e.g. unit, name over-ride, etc)
    config: FieldConfig;
}
```

With data frames, each column is represented by a **Field**. So the essence of a data frame is an field array with additional properties on both the data frame and its fields.

One restriction on data frames is that all fields in the frame must be of the same length to be a valid data frame.

### When is a data frame a time series or a table

Any valid data frame can be a table. If you have row-oriented data, the rows need to be converted to the data frame's column-oriented structure.

Because each field in a data frame has a type, we can use the types of the fields (the schema of the data frame) to determine if it data frame, or a collection of data frames, can be time series. In the simplest case, if a Frame has a Time field and Number field then it can be a time series (the frame should be sorted by time ascending).

#### Time series with unshared time values

A collection of time series that don't share a time index would be represented as an array of frames. For example, two time series (differentiated by their labels):

```text
Name: cpu
Dimensions: 2 fields by 2 rows
+---------------------+-----------------+
| Name: time          | Name: cpu       |
| Labels:             | Labels: host=a  |
| Type: []time.Time   | Type: []float64 |
+---------------------+-----------------+
| 2020-01-02 03:04:00 | 3               |
| 2020-01-02 03:05:00 | 6               |
+---------------------+-----------------+

Name: cpu
Dimensions: 2 fields by 2 rows
+---------------------+-----------------+
| Name: time          | Name: cpu       |
| Labels:             | Labels: host=b  |
| Type: []time.Time   | Type: []float64 |
+---------------------+-----------------+
| 2020-01-02 03:04:01 | 4               |
| 2020-01-02 03:05:01 | 7               |
+---------------------+-----------------+
```

The name of the time field doesn't matter, nor does its order in the frame (unless there are multiple time columns, in which case the first is used).

#### Time series with shared time values

If all the series share the same time values, then a "wide" format can be used:

```text
Name: Wide
Dimensions: 3 fields by 2 rows
+---------------------+-----------------+-----------------+
| Name: time          | Name: cpu       | Name: cpu       |
| Labels:             | Labels: host=a  | Labels: host=b  |
| Type: []time.Time   | Type: []float64 | Type: []float64 |
+---------------------+-----------------+-----------------+
| 2020-01-02 03:04:00 | 3               | 4               |
| 2020-01-02 03:05:00 | 6               | 7               |
+---------------------+-----------------+-----------------+
```

#### Time series in long format

(Note: Currently supported on backend only: [Grafana Issue #22219](https://github.com/grafana/grafana/issues/22219)).

A common CSV or SQL format is the [long (a.k.a tall/narrow) Format](https://en.wikipedia.org/wiki/Wide_and_narrow_data) of time series data.

This format is supported and is detected when there are string columns in the data frame. There can be multiple number and multiple string columns, and the series will be grouped.

For example a Long format Series:

```text
Name: Long
Dimensions: 4 fields by 4 rows
+---------------------+-----------------+-----------------+----------------+
| Name: time          | Name: aMetric   | Name: bMetric   | Name: host     |
| Labels:             | Labels:         | Labels:         | Labels:        |
| Type: []time.Time   | Type: []float64 | Type: []float64 | Type: []string |
+---------------------+-----------------+-----------------+----------------+
| 2020-01-02 03:04:00 | 2               | 10              | foo            |
| 2020-01-02 03:04:00 | 5               | 15              | bar            |
| 2020-01-02 03:05:00 | 3               | 11              | foo            |
| 2020-01-02 03:05:00 | 6               | 16              | bar            |
+---------------------+-----------------+-----------------+----------------+
```

Would look like the following in "Wide" format:

```text
Name: Wide
Dimensions: 5 fields by 2 rows
+---------------------+------------------+------------------+------------------+------------------+
| Name: time          | Name: aMetric    | Name: bMetric    | Name: aMetric    | Name: bMetric    |
| Labels:             | Labels: host=foo | Labels: host=foo | Labels: host=bar | Labels: host=bar |
| Type: []time.Time   | Type: []float64  | Type: []float64  | Type: []float64  | Type: []float64  |
+---------------------+------------------+------------------+------------------+------------------+
| 2020-01-02 03:04:00 | 2                | 10               | 5                | 15               |
| 2020-01-02 03:05:00 | 3                | 11               | 6                | 16               |
+---------------------+------------------+------------------+------------------+------------------+
```

## Technical references

This section contains links to technical reference and implementations of data frames.

### Apache Arrow

The dataframe structure is inspired by and uses the [Apache Arrow Project](https://arrow.apache.org/). Javascript Data frames use Arrow Tables as the underlying structure, and the backend Go code serializes its Frames in Arrow Tables for transmission.

### Javascript

The Javascript implementation of data frames is in the [`/src/dataframe` folder](https://github.com/grafana/grafana/tree/master/packages/grafana-data/src/dataframe) and [`/src/types/dataframe.ts`](https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/dataFrame.ts) of the [`@grafana/data` package](https://github.com/grafana/grafana/tree/master/packages/grafana-data).

### Go

For documentation on the Go implementation of data frames, refer to the [github.com/grafana/grafana-plugin-sdk-go/data package](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/data?tab=doc).
