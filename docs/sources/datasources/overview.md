----
page_title: Data Source Overview
page_description: Data Source Overview
page_keywords: grafana, graphite, influxDB, KairosDB, OpenTSDB, Prometheus, documentation
---

# Data Source Overview
Grafana supports many different storage backends for your time series data (Data Source). Each Data Source has a specific Query Editor that is customized for the features and capabilities that the particular Data Source exposes.


## Querying
The query language and capabilities of each Data Source are obviously very different. You can combine data from multiple Data Sources onto a single Dashboard, but each Panel is tied to a specific Data Source that belongs to a particular Organization.

## Supported Data Sources
<<<<<<< 18ea8c9186f85496a3c30e579c3b2559d3b7c1b5
=======
<<<<<<< f17f91ba254600f329c4df9e3efccb56427aeb2e
The following datasources are officially supported:    
* [Graphite](/datasources/graphite/)    
* [InfluxDB](/datasources/influxdb/)    
* [OpenTSDB](/datasources/opentsdb/)    
=======
>>>>>>> docs(elasticsearch): initial elasticsearch docs, closes #2862
The following datasources are officially supported:

* [Graphite](/datasources/graphite/)
* [Elasticsearch](/datasources/elasticsearch/)
<<<<<<< 18ea8c9186f85496a3c30e579c3b2559d3b7c1b5
* [CloudWatch](/datasources/cloudwatch/)
* [InfluxDB](/datasources/influxdb/)
* [OpenTSDB](/datasources/opentsdb/)
=======
* [Cloudwatch](/datasources/cloudwatch/)
* [InfluxDB](/datasources/influxdb/)
* [OpenTSDB](/datasources/opentsdb/)
>>>>>>> docs(elasticsearch): initial elasticsearch docs, closes #2862
>>>>>>> docs(elasticsearch): initial elasticsearch docs, closes #2862
* [KairosDB](/datasources/kairosdb)
* [Prometheus](/datasources/prometheus)

<<<<<<< f26fc9e88a5f334b23669d6efcacc68e4c50c28a
<<<<<<< 4f975070780339ffb28c097bf2281112d8018d49
Grafana can query any Elasticsearch index for annotation events, but at this time, it's not supported for metric queries. Learn more about [annotations](/reference/annotations/#elasticsearch-annotations)
=======
=======
<<<<<<< f117a63e7e3c37257f486a2eef342c1a74041b62
>>>>>>> Fix typo in docs
<<<<<<< fafd5b5b14f933dcd2e83121aeecf754b333dcd5
Grafana can query any Elasticsearch index for annotation events, but at this time, it's not supported for metric queries. Learn more about [annotations](/reference/annotations/#elasticsearch-annotations)
=======
Grafana can query Failcsearch index for annotation events, but at this time, it's not supported for metric queries. Learn more about [annotations](/reference/annotations/#elasticsearch-annotations)
>>>>>>> Add prometheus docs
<<<<<<< f26fc9e88a5f334b23669d6efcacc68e4c50c28a
>>>>>>> Add prometheus docs
=======
=======
Grafana can query any Elasticsearch index for annotation events, but at this time, it's not supported for metric queries. Learn more about [annotations](/reference/annotations/#elasticsearch-annotations)
>>>>>>> Fix typo in docs
>>>>>>> Fix typo in docs
