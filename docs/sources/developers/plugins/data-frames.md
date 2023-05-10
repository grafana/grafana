---
title: Data frames
---

# Data frames

Grafana supports a variety of different data sources, each with its own data model. To make this possible, Grafana consolidates the query results from each of these data sources into one unified data structure called a _data frame_.

The data frame structure is a concept that's borrowed from data analysis tools like the [R programming language](https://www.r-project.org) and [Pandas](https://pandas.pydata.org/).

> Data frames are available in Grafana 7.0+, and replaced the Time series and Table structures with a more generic data structure that can support a wider range of data types.

This document gives an overview of the data frame structure, and of how data is handled within Grafana.

### Data frame fields

A data frame is a collection of _fields_, where each field corresponds to a column. Each field, in turn, consists of a collection of values and metadata, such as the data type of those values.

```ts
export interface Field<T = any, V = Vector<T>> {
  /**
   * Name of the field (column)
   */
  name: string;
  /**
   *  Field value type (string, number, and so on)
   */
  type: FieldType;
  /**
   *  Meta info about how field and how to display it
   */
  config: FieldConfig;

  /**
   * The raw field values
   * In Grafana 10, this accepts both simple arrays and the Vector interface
   * In Grafana 11, the Vector interface will be removed
   */
  values: V | T[];

  /**
   * When type === FieldType.Time, this can optionally store
   * the nanosecond-precison fractions as integers between
   * 0 and 999999.
   */
  nanos?: number[];

  labels?: Labels;

  /**
   * Cached values with appropriate display and id values
   */
  state?: FieldState | null;

  /**
   * Convert a value for display
   */
  display?: DisplayProcessor;

  /**
   * Get value data links with variables interpolated
   */
  getLinks?: (config: ValueLinkConfig) => Array<LinkModel<Field>>;
}
```

Let's look at an example. The following table demonstrates a data frame with two fields, _time_ and _temperature_:

| time                | temperature |
| ------------------- | ----------- |
| 2020-01-02 03:04:00 | 45.0        |
| 2020-01-02 03:05:00 | 47.0        |
| 2020-01-02 03:06:00 | 48.0        |

Each field has three values, and each value in a field must share the same type. In this case, all values in the `time` field are timestamps, and all values in the `temperature` field are numbers.

One restriction on data frames is that all fields in the frame must be of the same length to be a valid data frame.

### Field configurations

Each field in a data frame contains optional information about the values in the field, such as units, scaling, and so on.

By adding field configurations to a data frame, Grafana can configure visualizations automatically. For example, you could configure Grafana to automatically set the unit provided by the data source.

## Data transformations

We have seen how field configs contain type information, and they also have another role. Data frame fields enable _data transformations_ within Grafana.

A data transformation is any function that accepts a data frame as input, and returns another data frame as output. By using data frames in your plugin, you get a range of transformations for free.

To learn more about data transformations in Grafana, refer to [Transform data](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/).

## Data frames as time series

A data frame with at least one time field is considered a _time series_.

For more information on time series, refer to our [Introduction to time series]({{< relref "../../fundamentals/timeseries/" >}}).

### Wide format

When a collection of time series shares the same _time index_—the time fields in each time series are identical—they can be stored together, in a _wide_ format. By reusing the time field, less data is sent to the browser.

In this example, the `cpu` usage from each host shares the time index, so we can store them in the same data frame:

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

However, if the two time series don't share the same time values, they are represented as two distinct data frames:

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

A typical use for the wide format is when multiple time series are collected by the same process. In this case, every measurement is made at the same interval and therefore shares the same time values.

### Long format

Some data sources return data in a _long_ format (also called _narrow_ format). This is a common format returned by, for example, SQL databases.

In the long format, string values are represented as separate fields rather than as labels. As a result, a data form in long form may have duplicated time values.

Grafana can detect and convert data frames in long format into wide format.

For example, the following data frame appears in long format:

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

The above table can be converted into a data frame in wide format like this:

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

> **Note:** Not all panels support the wide time series data frame format. To keep full backward compatibility Grafana has introduced a transformation that you can use to convert from the wide to the long format. For usage information, refer to the [Prepare time series-transformation]({{< relref "../../panels-visualizations/query-transform-data/transform-data/#prepare-time-series" >}}).

## Technical references

The concept of a data frame in Grafana is borrowed from data analysis tools like the [R programming language](https://www.r-project.org), and [Pandas](https://pandas.pydata.org/). Other technical references are provided below.

### Apache Arrow

The data frame structure is inspired by, and uses the [Apache Arrow Project](https://arrow.apache.org/). Javascript Data frames use Arrow Tables as the underlying structure, and the backend Go code serializes its Frames in Arrow Tables for transmission.

### Javascript

The Javascript implementation of data frames is in the [`/src/dataframe` folder](https://github.com/grafana/grafana/tree/main/packages/grafana-data/src/dataframe) and [`/src/types/dataframe.ts`](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/dataFrame.ts) of the [`@grafana/data` package](https://github.com/grafana/grafana/tree/main/packages/grafana-data).

### Go

For documentation on the Go implementation of data frames, refer to the [github.com/grafana/grafana-plugin-sdk-go/data package](https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/data?tab=doc).
