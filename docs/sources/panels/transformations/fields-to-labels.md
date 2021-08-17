+++
title = "Fields to labels"
weight = 300
+++

# Fields to labels transform

> **Note:** This is a new beta transformation introduced in v8.1.

This transformation allows you to split time series to multiple time series based on the values of selected fields which also become label values for their respective time series. This transformation provides the inverse behavior to the [Labels to fields]({{< relref "./types-options.md#labels-to-fields" >}}).

## Example

Given a query result with a single time series:

| Time               | Datacenter | Server A | Server B |
| ------------------ | ---------- | -------- | -------- |
| 2021-08-17 2:14:35 | EU         | 1        | 2        |
| 2021-08-17 2:14:35 | US         | 3        | 4        |
| 2021-08-17 2:15:05 | EU         | 1        | 3        |
| 2021-08-17 2:15:05 | US         | 3        | 5        |

If we configured the transformation to use the Datacenter field to create labels, this would result in two time series like these:

- Series 1: label Datacenter=EU
  | Time | Server A | Server B |
  | ------------------ | -------- | -------- |
  | 2021-08-17 2:14:35 | 1 | 2 |
  | 2021-08-17 2:15:05 | 1 | 3 |
- Series 2: label Datacenter=US
  | Time | Server A | Server B |
  | ------------------ | -------- | -------- |
  | 2021-08-17 2:14:35 | 3 | 4 |
  | 2021-08-17 2:15:05 | 3 | 5 |

## Configuration

You may select multiple **Label fields** which will be used as label values. As a result you will get as many time series as there are unique label field combinations coming from your input data.
