---
aliases:
  - ../basics/timeseries/
description: Introduction to Prometheus
keywords:
  - grafana
  - intro
  - Prometheus
  - metrics
  - time series
title: What is Prometheus?
weight: 300
---

# What is Prometheus?

Observability focuses on understanding the internal state of your systems based on the data they produce, which helps determine if your infrastructure is healthy. Prometheus is a core technology for system observability, but the term "Prometheus" can be confusing because it is used in different contexts. Understanding Prometheus basics, why it’s valuable for system observability, and how people use it in practice will both help you better understand it and help you use Grafana.

Prometheus was started in 2012 at SoundCloud, who found existing technologies such as Graphite insufficient for their observability needs. Prometheus has a robust data model and query language, both of which are addressed in the following sections, and is simple and scalable. In 2018, Prometheus graduated from Cloud Native Computing Foundation (CNCF) incubation, and today has a thriving community.

## Prometheus as data

The following panel in a Grafana dashboard shows how much disk bandwidth on a Mac laptop is being used. The green line represents disk `reads`, and the yellow line represents `writes`.

{{< figure src="/media/docs/grafana/intro-prometheus/disk-io.png" max-width="750px" caption="Disk I/O dashboard" >}}

Data like these form _time series_. The X-axis is a moment in time, and the Y-axis is a number or measurement, for example, 5 megabytes per second. This kind of time series data appears everywhere in systems monitoring, but also in places like seasonal temperature charts and stock prices. This data is simply some measurement (such as the Tesla stock price, or Disk I/O) through a series of time instants.

Prometheus is a technology used to collect and store time series data. Time series are fundamental to Prometheus; its [data model](https://prometheus.io/docs/concepts/data_model/) is arranged into:

- _metrics_ that consist of a _timestamp_ and a _sample_, which is the numeric value, such as how many disk bytes have been read or a stock price
- a set of labels called _dimensions_

You can store time series data in any relational database, but these kinds of systems are not developed to store and query large volumes of time series data. Prometheus and similar software provide tools to compact and optimize time series data.

### Example

The following Grafana dashboard image shows a disk IO graph of raw data from Prometheus that is derived from a laptop.

The **Metrics browser** field contains the following query:

`node_disk_written_bytes_total{job=”integrations/macos-node”, device!=””}`

In this example, the Y-axis shows the total number of bytes written, and the X-axis shows dates and times. As the laptop runs, the number of bytes written increases over time. Below **Metrics browser** is a counter that counts the number of bytes written over time.

{{< figure src="/media/docs/grafana/intro-prometheus/dashboard-example.png" max-width="750px" caption="Metrics browser and counter" >}}

The query is a simple example of [PromQL](/blog/2020/02/04/introduction-to-promql-the-prometheus-query-language/), the Prometheus Query Language. It identifies the metric of interest (`node_disk_written_bytes_total`) and provides two labels (`job` and `device`). The label selector `job=”integrations/macos-node”` is used to filter metrics. It reduces the scope of the metrics to those coming from the MacOS integration job, and specifies that the “device” label cannot be empty. The result of this query is the raw stream of numbers that the graph shows.

Although this view provides some insight into the performance of the system, it doesn’t provide the full story. For a clearer picture of system performance, it is also important to understand the rate of change that shows _how fast the data being written is changing_. To properly monitor disk performance, it is important to see spikes in activity to understand if and when the system is under load, and whether or not disk performance is at risk. PromQL includes a [rate()](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate) function that shows the per-second average rate of increase over `5m` (5-minute) intervals. This view provides a much better idea of what’s happening with the system.

{{< figure src="/media/docs/grafana/intro-prometheus/rate-function.png" max-width="750px" caption="Prometheus rate function" >}}

A counter metric is just one type of metric. Prometheus [supports several others](https://prometheus.io/docs/concepts/metric_types/). A counter is a number (such as total bytes written) that only goes up. A second metric type is called a `gauge`, which can go up or down.

The following gauge visualization shows the total RAM usage on a computer.

{{< figure src="/media/docs/grafana/intro-prometheus/gauge-example.png" max-width="750px" caption="Gauge visualization" >}}

The third metric type is called a `histogram`, which counts observations and puts them into configurable groups. The following example shows floating-point numbers grouped into ranges that show how often each occurred.

{{< figure src="/media/docs/grafana/intro-prometheus/histogram-example.png" max-width="750px" caption="Historgram visualization" >}}

These core concepts of time series, metrics, labels, and aggregation functions are foundational to Grafana and observability.

## Why this is valuable

Software and systems are a difficult business. Sometimes things go wrong. Observability helps you understand a system’s state so that future issues can be proactively addressed. And when problems do occur, you can diagnose and solve them within your Service Level Objectives (SLOs). The [three pillars of observability](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/ch04.html) are metrics, logs, and traces and Prometheus supports the metric pillar. When software on a computer runs slowly, observability can help identify whether the CPU is saturated, the system is out of memory, or if the disk is writing at maximum speed.

## Prometheus as software

Prometheus isn’t just a data format; many people refer to it as an [open source systems monitoring and alerting toolkit](https://prometheus.io/docs/introduction/overview/). That’s because Prometheus is software, not just data.

Prometheus can scrape metric data from software and infrastructure and store it. Scraping means that Prometheus software periodically revisits the same endpoint to check for new data. Prometheus “scrapes” data from a piece of software that is instrumented with a client library.

For example, a NodeJS application can configure the [prom-client](https://github.com/siimon/prom-client) to expose metrics easily at an endpoint, and Prometheus can regularly scrape that endpoint. There are a number of other tools available within the Prometheus toolkit that you can use to instrument applications.

## Prometheus as deployment

The first section of this document introduced the _Prometheus as Data_ concept and how the Prometheus data model and metrics are organized. The second section introduced the concept of _Prometheus as Software_ that is used to collect, process, and store metrics.

This section describes how “Prometheus as Data" and “Prometheus as Software” come together. Suppose an application called `MyApp` uses a Prometheus client to expose metrics. One approach to collecting metrics data is to use a URL in the application that points to an endpoint `http://localhost:3000/metrics` that produces Prometheus metrics data.

The following image shows the two metrics associated with the endpoint. The HELP text explains what the metric means, and the TYPE text indicates what kind of metric it is (in this case, a gauge). `MyAppnodejs_active_request_total` indicates the number of requests (in this case, `1`). `MyAppnodejs_heap_size_total_bytes` indicates the heap size reported in bytes. There are only two numbers because this data shows the value at the moment the data was fetched.

{{< figure src="/media/docs/grafana/intro-prometheus/endpoint-data.png" max-width="750px" caption="Endpoint example" >}}

These metrics are available in an HTTP endpoint, but how do they get to Grafana, and subsequently, into a dashboard?

That’s where you can use either the Prometheus software, or the [Grafana Agent](/docs/agent/latest/). The Grafana Agent collects and forwards telemetry data to open sourcevdeployments of the Grafana Stack, Grafana Cloud, or Grafana Enterprise, where your data can then be analyzed.

Telemetry refers to the process of recording and transmitting the readings of an application or piece of infrastructure. Telemetry is critical to observability because it helps you understand exactly what's going on in your infrastructure. Telemetry data is a source of truth.

Those metrics above, for example, `MyAppnodejs_active_requests_total`, is telemetry data. MyApp only makes it available for pull by means of an HTTP request. You can configure the Grafana Agent to pull that data from MyApp every 5 seconds, and send the results to Grafana Cloud.

The following image illustrates how the Grafana Agent works as an intermediary between MyApp and Grafana Cloud.

{{< figure src="/media/docs/grafana/intro-prometheus/grafana-agent.png" max-width="750px" caption="Grafana Agent" >}}

## Bringing it together

The combination of Prometheus and the Grafana Agent gives you incredible control over the metrics you want to report, where they come from, and where they’re going. Once the data is in Grafana, it can be stored in a Grafana Mimir database. Grafana dashboards consist of visualizations populated by data queried from the Prometheus data source. The PromQL query filters and aggregates the data to provide you the insight you need. With those steps, we’ve gone from raw numbers, generated by software, into Prometheus, delivered to Grafana, queried by PromQL, and visualized by Grafana.

## What’s next?

Now that you understand the basics of how Prometheus telemetry works, what will you build with it?

- One great next step is to [build a dashboard]({{< relref "../../dashboards/build-dashboards/" >}}) in Grafana and start turning that raw Prometheus telemetry data into insights about what’s going with your services and infrastructure.
- Another great step is to learn about [Grafana Mimir](/oss/mimir/), which is essentially a database for Prometheus data. If you’re wondering how to make this work for a huge number of metrics with a lot of data and fast querying, check out Grafana Mimir.
- If you’re interested in working with Prometheus data in Grafana directly, check out the [Prometheus data source]({{< relref "../../datasources/prometheus/" >}}) documentation, or check out [PromQL basics](https://prometheus.io/docs/prometheus/latest/querying/basics/).
