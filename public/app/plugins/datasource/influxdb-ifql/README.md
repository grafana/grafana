# InfluxDB (IFQL) Datasource [BETA] -  Native Plugin

Grafana ships with **built in** support for InfluxDB (>= 1.4.1).

Use this datasource if you want to use IFQL to query your InfluxDB.
Feel free to run this datasource side-by-side with the non-IFQL datasource.
If you point both datasources to the same InfluxDB instance, you can switch query mode by switching the datasources.

Read more about IFQL here:

[https://github.com/influxdata/ifql](https://github.com/influxdata/ifql)

Read more about InfluxDB here:

[http://docs.grafana.org/datasources/influxdb/](http://docs.grafana.org/datasources/influxdb/)

## Roadmap

- Sync Grafana time ranges with `range()`
- Template variable expansion
- Syntax highlighting
- Tab completion (functions, values)
- Result helpers (result counts, table previews)
- Annotations support
- Alerting integration
- Explore UI integration
