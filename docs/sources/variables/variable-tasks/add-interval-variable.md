



# Add an interval variable

Use the `Interval` type to create a variable that represents a time span (eg. `1m`,`1h`, `1d`). There is also a special `auto` option that will change depending on the current time range. You can specify how many times the current time range should be divided to calculate the current `auto` timespan.

This variable type is useful as a parameter to group by time (for InfluxDB), Date histogram interval (for Elasticsearch) or as a *summarize* function parameter (for Graphite).

Example using the template variable `myinterval` of type `Interval` in a graphite function:

```
summarize($myinterval, sum, false)
```
