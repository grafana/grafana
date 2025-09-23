---
description: Upload a JSON trace file to the Tempo data source
keywords:
  - grafana
  - tempo
  - guide
  - tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Upload JSON trace file
title: Upload a JSON trace file
weight: 900
aliases:
  - ../json-trace-file/ # /docs/grafana/latest/datasources/tempo/json-trace-file
---

# Upload a JSON trace file

You can upload a JSON file that contains a single trace and visualize it.
If the file has multiple traces, Grafana visualizes the first trace.

To upload a trace file:

1. Select **Explore** in Grafana.
1. Select **Import trace** in the right corner.
1. Upload your JSON trace file.

## Download a trace or service graph

To download a trace or Service Graph through the [Inspector panel](https://grafana.com/docs/grafana/<TEMPO_VERSION>/explore/explore-inspector/):

1. Open the inspector.
1. Navigate to the **Data** tab.
1. Click **Download traces** or **Download Service Graph**.

## Trace JSON example

```json
{
  "batches": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "db" } },
          { "key": "job", "value": { "stringValue": "tns/db" } },
          { "key": "opencensus.exporterversion", "value": { "stringValue": "Jaeger-Go-2.22.1" } },
          { "key": "host.name", "value": { "stringValue": "63d16772b4a2" } },
          { "key": "ip", "value": { "stringValue": "0.0.0.0" } },
          { "key": "client-uuid", "value": { "stringValue": "39fb01637a579639" } }
        ]
      },
      "instrumentationLibrarySpans": [
        {
          "instrumentationLibrary": {},
          "spans": [
            {
              "traceId": "AAAAAAAAAABguiq7RPE+rg==",
              "spanId": "cmteMBAvwNA=",
              "parentSpanId": "OY8PIaPbma4=",
              "name": "HTTP GET - root",
              "kind": "SPAN_KIND_SERVER",
              "startTimeUnixNano": "1627471657255809000",
              "endTimeUnixNano": "1627471657256268000",
              "attributes": [
                { "key": "http.status_code", "value": { "intValue": "200" } },
                { "key": "http.method", "value": { "stringValue": "GET" } },
                { "key": "http.url", "value": { "stringValue": "/" } },
                { "key": "component", "value": { "stringValue": "net/http" } }
              ],
              "status": {}
            }
          ]
        }
      ]
    }
  ]
}
```
