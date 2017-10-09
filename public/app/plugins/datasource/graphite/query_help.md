#### Get Shorter legend names

- alias() function to specify a custom series name
- aliasByNode(2) to alias by a specific part of your metric path
- groupByNode(2, 'sum') is useful if you have 2 wildcards in your metric path and want to sumSeries and group by.

#### Series as parameter

- Some graphite functions allow you to have many series arguments
- Use #[A-Z] to use a graphite query as parameter to a function
- Examples:
  - asPercent(#A, #B)
  - divideSeries(#A, #B)

If a query is added only to be used as a parameter, hide it from the graph with the eye icon

#### Max data points
- Every graphite request is issued with a maxDataPoints parameter
- Graphite uses this parameter to consolidate the real number of values down to this number
- If there are more real values, then by default they will be consolidated using averages
- This could hide real peaks and max values in your series
- You can change how point consolidation is made using the consolidateBy graphite function
- Point consolidation will effect series legend values (min,max,total,current)
- if you override maxDataPoint and set a high value performance can be severely effected

#### Documentation links:

[Grafana's Graphite Documentation](http://docs.grafana.org/features/datasources/graphite)

[Official Graphite Documentation](https://graphite.readthedocs.io)
