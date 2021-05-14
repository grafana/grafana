+++
title = "Exemplars"
description = "Exemplars"
keywords = ["grafana", "concepts", "exemplars", "prometheus"]
weight = 400
+++

# Exemplars

An exemplar is a specific trace representative of a repeated pattern of data in a given time interval. It helps you identify higher cardinality metadata for specific events within time series data.

Use exemplars to help isolate problems within your data distribution by pin-pointing query traces exhibiting high latency within a time interval.

Suppose your company’s website is experiencing a surge in traffic volumes. While more than eighty percent of the users are able to access the website in under two seconds, some users are experiencing a higher than normal response time resulting in bad user experience. To identify the factors that are contributing to the latency, you have to compare a trace for a fast response against a trace for a slow response. Given the vast amount of data in a typical production environment, it will be extremely laborious and time consuming effort. 

Leverage exemplars , the hard work is done for you with representative traces highlighted in the graph, like isolating a signal from the noise.Once you localize the latency problem to a few exemplar traces, you can combine it with additional system based information or location properties to perform a root cause analysis faster, leading to quick resolutions to performance issues.

Support for exemplars is available for the Prometheus data source. Once you enable the functionality, exemplars data is available by default. For more information on exemplar configuration on how to enable exemplars, refer to https://grafana.com/docs/grafana/latest/datasources/prometheus/#exemplars.

Grafana shows exemplars alongside a metric in the Explore view and in Dashboards. Each exemplar displays as a highlighted star. You can hover your cursor over an exemplar to view the unique traceID, which is a combination of a key value pair. To investigate further, you can drill down from the metric time series to the trace details with one click on the traceID. 


