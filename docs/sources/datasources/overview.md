----
page_title: Data Source Overview
page_description: Data Source Overview
page_keywords: grafana, graphite, influxDB, KairosDB, OpenTSDB, documentation
---

# Data Source Overview
Grafana supports many different storage backends for your time series data (Data Source). Each Data Source has a specific Query Editor that is customized for the features and capabilities that the particular Data Source exposes. 


## Querying
The query language and capabilities of each Data Source are obviously very different. You can combine data from multiple Data Sources onto a single Dashboard, but each Panel is tied to a specific Data Source that belongs to a particular Organization.

## Supported Data Sources
The following datasources are officially supported:    
* [Graphite](/datasources/graphite/)    
* [InfluxDB](/datasources/influxdb/)    
* [OpenTSDB](/datasources/opentsdb/)    
* [KairosDB](/datasources/kairosdb)

Grafana can query any Elasticsearch index for annotation events, but at this time, it's not supported for metric queries. Learn more about [annotations](/reference/annotations/#elasticsearch-annotations)