---
title: HTTP API
weight: 2
---

# HTTP API

The HTTP API is the same as that of Graphite, with the addition of ingestion, authentication and meta tags.

First of all, there are two endpoints you will be talking to. They are provided on your grafana.com Hosted Metrics instance details page.

They will look something like:

* `<base_in>` : `https://something.grafana.net/metrics`
* `<base_out>` : `https://something.grafana.net/graphite`

Furthermore, you will need to provision API keys to talk to the API. Each key will be of one of these types:

* Viewer
* MetricsPublisher
* Editor
* Admin

A "Viewer" key can only be used to execute queries, while a "MetricsPublisher" key can only be used to push metrics into the platform.  "Editor" and "Admin" keys can be used for both pushing metrics and performing queries.

API keys can be provisioned on your Grafana.com organization page under "Security > API Keys".

## Authentication

Authentication differs depending on whether your instance is provisioned on a dedicated or a shared cluster.
How to tell the difference?
On your Grafana.com instance details page, if your query and metrics endpoint look generic like this:

```
https://graphite-us-central1.grafana.net/graphite
https://graphite-us-central1.grafana.net/metrics
```

Then you are on a shared cluster. However if your URL's look more like this:

```
https://tsdb-123-your-company-name.hosted-metrics.grafana.net/graphite
https://tsdb-123-your-company-name.hosted-metrics.grafana.net/metrics
```

Then you are on a dedicated cluster.

You have several ways to authenticate:

* For dedicated clusters, any of these HTTP headers will work:

```
Authorization: Basic base64(api_key:<api key>)
Authorization: Bearer <api key>
Authorization: Bearer api_key:<api key>
```

* For shared clusters, use any of these HTTP headers:

```
Authorization: Basic base64(<instance id>:<api key>)
Authorization: Bearer <instance id>:<api key>
```

Note that you can find the instance ID as the username in the "Using Grafana with Hosted Metrics" section of your Grafana.com instance details page

So essentially you can use basic auth with username "api_key" (for dedicated clusters) or your instance ID (for shared clusters) and password the api key that you provisoned

You can also use a bearer token in "username:password" format (if username not specified, "api_key" is assumed)

## Common Request Parameters

Many of the API methods involve using Graphite patterns (queries), tag queries and the standard Graphite from/to syntax.

### Graphite Patterns

[Graphite patterns](https://graphite.readthedocs.io/en/latest/render_api.html#paths-and-wildcards) are queries that involve glob patterns (`*`, `{}`, `[]`, `?`).

### Tag Expressions

Tags expressions are strings, and may have the following formats:

```
tag=spec    tag value exactly matches spec
tag!=spec   tag value does not exactly match spec
tag=~value  tag value matches the regular expression spec
tag!=~spec  tag value does not match the regular expression spec
```

Any tag spec that matches an empty value is considered to match series that don’t have that tag, and at least one tag spec must require a non-empty value.
Regular expression conditions are treated as being anchored at the start of the value.

### From/To (Until)

[Graphite from/to](https://graphite.readthedocs.io/en/latest/render_api.html#from-until)

## Endpoints


### Adding New Data: Posting To `/metrics`

The main entry point for any publisher to publish data to, be it [carbon-relay-ng](https://github.com/graphite-ng/carbon-relay-ng/), or any other script or application such as the [hosted-metrics-sender-example](https://github.com/grafana/hosted-metrics-sender-example)

* Method: POST
* API key type: any (including Viewer)

#### Headers

* `Authorization:` header is required (see authentication section above)
* `Content-Type`: supports 3 values:
  - `application/json`: the simplest one, and the one used here
  - `rt-metric-binary`: same datastructure, but messagepack encoded. (see [the MetricData Marshal/Encode methods](https://godoc.org/github.com/grafana/metrictank/schema#MetricData))
  - `rt-metric-binary-snappy`: same as above, but snappy compressed.

#### Data Format

Each metricpoint message can have the following properties:
```
name     // graphite style name (required)
interval // the resolution of the metric in seconds (required)
value    // float64 value (required)
time     // unix timestamp in seconds (required)
tags     // list of key=value pairs of tags (optional)
```

#### Example

```sh
timestamp_now_rounded=$(($(date +%s) / 10 * 10))
timestamp_prev_rounded=$((timestamp_now_rounded - 10))

curl -X POST -H "Authorization: Bearer $key" -H "Content-Type: application/json" "$base_in" -d '[{
    "name": "test.metric",
    "interval": 10,
    "value": 12.345,
    "time": '$timestamp_prev_rounded'
},
{
    "name": "test.metric",
    "interval": 10,
    "value": 12.345,
    "time": '$timestamp_now_rounded'
},
{
    "name": "test.metric.tagged",
    "interval": 10,
    "value": 1,
    "tags": ["foo=bar", "baz=quux"],
    "time": '$timestamp_prev_rounded'
},
{
    "name": "test.metric.tagged",
    "interval": 10,
    "value": 2,
    "tags": ["foo=bar", "baz=quux"],
    "time": '$timestamp_now_rounded'
}
]'

```

### Deleting Metrics
#### Non-tagged With `/metrics/delete`

Deletes metrics which match the `query` and all child nodes.

Note that unlike the find and render patterns, these queries are recursive.
So if the delete query matches a branch, **every** series under that branch will be deleted.
Note that the data stays in the datastore until it expires.
Should the metrics enter the system again with the same metadata, the data will show up again.

* Method: POST
* API key type: Editor

##### Parameters

* user name: `api_key`
* password: Your Grafana.com API Key
* query (required): [Graphite pattern] (#graphite-patterns)

##### Example

```sh
curl -u "api_key:<Your Grafana.com API Key>" https://$base_out/metrics/delete -d query=some.series.to.delete.*
```

#### Tagged With `/tags/delSeries`

Deletes metrics which match the `path` parameter(s).
Note that the data stays in the datastore until it expires.
Should the metrics enter the system again with the same metadata, the data will show up again.


* Method: POST
* API key type: Editor

##### Parameters

* user name: `api_key`
* password: Your Grafana.com API Key
* path (required, multiple allowed): A single Graphite series

##### Example

```sh
curl -u "api_key:<Your Grafana.com API Key>" https://$base_out/tags/delSeries -d "path=some.series;key=value" -d "path=another.series;tag=value"
```

### Finding Metrics
#### Non-tagged With `/metrics/find`

Returns metrics which match the `query` and have received an update since `from`.

* Method: GET or POST
* API key type: any (including MetricsPublisher)

##### Headers

* `Authorization: Bearer <api-key>` required

##### Parameters

* query (required): [Graphite pattern](#graphite-patterns)
* format: json, treejson, completer, pickle, or msgpack. (defaults to json)
* jsonp: true/false: enables jsonp
* from: Graphite from time specification (defaults to now-24hours)

##### Output formats

* json, treejson (default/unspecified): the standard format
* completer: used for graphite-web's completer UI
* msgpack: optimized transfer format
* pickle: deprecated


##### Example

```sh
curl -H "Authorization: Bearer $key" "$base_out/metrics/find?query=metrictank"
[
    {
        "allowChildren": 1,
        "expandable": 1,
        "leaf": 0,
        "id": "metrictank",
        "text": "metrictank",
        "context": {}
    }
]
```

The response indicates that there are metric names that live under the "metrictank" term (it is expandable)
and there is no data under the name "metrictank" (it is not a leaf node).

So we update the query to see what we can expand to:

```sh
curl -H "Authorization: Bearer $key" "$base_out/metrics/find?query=metrictank.*"
[
    {
        "allowChildren": 1,
        "expandable": 1,
        "leaf": 0,
        "id": "metrictank.aggstats",
        "text": "aggstats",
        "context": {}
    }
]
```

The response for the updated query shows which data lives under the "metrictank" name, in this case the tree extends under "metrictank.aggstats".

As we continue to dig deeper into the tree, by updating our query based on what we get back, we eventually end up at the leaf:

```sh
curl -H "Authorization: Bearer $key" "$base_out/metrics/find?query=metrictank.aggstats.*.tank.metrics_active.gauge32"
[
    {
        "allowChildren": 0,
        "expandable": 0,
        "leaf": 1,
        "id": "metrictank.aggstats.us-east2-id-name.tank.metrics_active.gauge32",
        "text": "gauge32",
        "context": {}
    }
]
```

#### Tagged With `/tags/findSeries`

Returns metrics which match tag queries and have received an update since `from`.
Note: the returned results are not deduplicated and in certain cases it is possible
that duplicate entries will be returned.

* Method: GET or POST
* API key type: any (including MetricsPublisher)

##### Headers

* `Authorization: Bearer <api-key>` required

##### Parameters

* expr (required): a list of [tag expressions](#tag-expressions)
* from: Graphite [from time specification](#fromto) (optional. defaults to now-24hours)
* format: series-json, lastts-json. (defaults to series-json)
* limit: max number to return. (default: 0)
  Note: the resultset is also subjected to the cluster configuration.
  if the result set is larger than the cluster configuration, an error is returned. If it breaches the provided limit, the result is truncated.
* meta: If false and format is `series-json` then return series names as array (graphite compatibility). If true, include meta information like warnings.  (defaults to false)

##### Example

```sh
curl -H "Authorization: Bearer $key" "$base_out/tags/findSeries?expr=datacenter=dc1&expr=server=web01"

[
  "disk.used;datacenter=dc1;rack=a1;server=web01"
]
```

```sh
curl -H "Authorization: Bearer $key" "$base_out/tags/findSeries?expr=datacenter=dc1&expr=server=web01&format=lastts-json"

{
    "series": [
        {
            "lastTs": 1576683990,
            "val": "disk.used;datacenter=dc1;rack=a1;server=web01"
        }
    ]
}
```

### Tag Exploration

#### Count tag values With `/tags/terms`

Returns count of series for each tag value which matches tag queries for a given set of tag keys.

* Method: GET or POST
* API key type: any (including MetricsPublisher)

##### Headers

* `Authorization: Bearer <api-key>` required

##### Parameters

* expr (required): a list of [tag expressions](#tag-expressions)
* tags: a list of tag keys for which to count values series

##### Example

```sh
curl -H "Authorization: Bearer $key" "$base_out/tags/terms?expr=datacenter=dc1&expr=server=web01&tags=rack"

{
  "totalSeries": 5892,
  "terms": {
    "rack": {
      "a1": 2480,
      "a2": 465,
      "b1": 2480,
      "b2": 467
    }
  }
}
```

### Render `/render` (return data for a given query)

Graphite-web-like api. It can return JSON, pickle or messagepack output

* Method: GET or POST (recommended. as GET may result in too long URL's)
* API key type: any (viewer, publisher, editor)

##### Headers

* `Authorization: Bearer <api-key>` required


##### Parameters

* maxDataPoints: int (default: 800)
* target: mandatory. one or more metric names or [patterns](#graphite-patterns).
* from: see [timespec format](#tspec) (default: 24h ago) (exclusive)
* to/until : see [timespec format](#tspec)(default: now) (inclusive)
* format: json, msgp, pickle, or msgpack (default: json) (note: msgp and msgpack are similar, but msgpack is for use with graphite)
* meta: use 'meta=true' to enable metadata in response (performance measurements)
* process: all, stable, none (default: stable). Controls metrictank's eagerness of fulfilling the request with its built-in processing functions
  (as opposed to proxying to the fallback graphite).
  - all: process request without fallback if we have all the needed functions, even if they are marked unstable (under development)
  - stable: process request without fallback if we have all the needed functions and they are marked as stable.
  - none: always defer to graphite for processing.

  If metrictank doesn't have a requested function, it always proxies to graphite, irrespective of this setting.

Data queried for must be stored under the given org or be public data (see [multi-tenancy](https://github.com/grafana/metrictank/blob/master/docs/multi-tenancy.md))

#### Example

```bash
curl -H "Authorization: Bearer $key" "http://localhost:6060/render?target=statsd.fakesite.counters.session_start.*.count&from=3h&to=2h"
```
