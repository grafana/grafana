#### Alias patterns
- replaced with measurement name
- $measurement = replaced with measurement name
- $1 - $9 = replaced with part of measurement name (if you separate your measurement name with dots)
- $col = replaced with column name
- $tag_exampletag = replaced with the value of the <i>exampletag</i> tag
- You can also use [[tag_exampletag]] pattern replacement syntax

#### Stacking and fill
- When stacking is enabled it is important that points align
- If there are missing points for one series it can cause gaps or missing bars
- You must use fill(0), and select a group by time low limit
- Use the group by time option below your queries and specify for example 10s if your metrics are written every 10 seconds
- This will insert zeros for series that are missing measurements and will make stacking work properly

#### Group by time
- Group by time is important, otherwise the query could return many thousands of datapoints that will slow down Grafana
- Leave the group by time field empty for each query and it will be calculated based on time range and pixel width of the graph
- If you use fill(0) or fill(null) set a low limit for the auto group by time interval
- The low limit can only be set in the group by time option below your queries
- Example: 60s if you write metrics to InfluxDB every 60 seconds

#### Documentation links:

[Grafana's InfluxDB Documentation](http://docs.grafana.org/features/datasources/influxdb)

[Official InfluxDB Documentation](https://docs.influxdata.com/influxdb)
