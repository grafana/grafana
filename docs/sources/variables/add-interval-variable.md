+++
title = "Add an interval variable"
type = "docs"
[menu.docs]
weight = 500
+++

# Add an interval variable

Use an _interval_ variable to represents time spans such as `1m`,`1h`, `1d`. This variable type is useful as a parameter to `group by time` (for InfluxDB), Date histogram interval (for Elasticsearch) or as a `summarize` function parameter (for Graphite).

There is also a special `auto` option that will change depending on the current time range. You can specify how many times the current time range should be divided to calculate the current `auto` time span.


Example using the template variable `myinterval` of type `Interval` in a graphite function:

```
summarize($myinterval, sum, false)
```
