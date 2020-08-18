+++
title = "Common observability strategies"
description = "Common observability strategies"
keywords = ["grafana", "intro", "guide", "concepts", "methods"]
aliases = ["/docs/grafana/latest/getting-started/strategies/"]
type = "docs"
[menu.docs]
weight = 500
+++

# Common observability strategies

When you have a lot to monitor, like a server farm, you need a strategy to decide what is important enough to monitor. This page describes several common methods for choosing what to monitor.

A logical strategy allows you to make uniform dashboards and scale your observability platform more easily.

## Guidelines for usage

- The USE method tells you how happy your machines are, the RED method tells you how happy your users are.
- USE reports on causes of issues. 
- RED reports on user experience and is more likely to report symptoms of problems.
- The best practice of alerting is to alert on symptoms rather than causes, so alerting should be done on RED dashboards.

## USE method

USE stands for:

- **Utilization -** Percent time the resource is busy, such as node CPU usage
- **Saturation -** Amount of work a resource has to do, often queue length or node load
- **Errors -** Count of error events

This method is best for hardware resources in infrastructure, such as CPU, memory, and network devices. For more information, refer to [The USE Method](http://www.brendangregg.com/usemethod.html).

## RED method

RED stands for:

- **Rate -** Requests per second
- **Errors -** Number of requests that are failing
- **Duration -** Amount of time these requests take, distribution of latency measurements

This method is most applicable to services, especially a microservices environment. For each of your services, instrument the code to expose these metrics for each component. RED dashboards are good for alerting and SLAs. A well-designed RED dashboard is a proxy for user experience.

For more information, refer to Tom Wilkie's blog post [The RED method: How to instrument your services](https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services).

## The Four Golden Signals

According to the [Google SRE handbook](https://landing.google.com/sre/sre-book/chapters/monitoring-distributed-systems/#xref_monitoring_golden-signals), if you can only measure four metrics of your user-facing system, focus on these four.

This method is similar to the RED method, but it includes saturation.

- **Latency -** Time taken to serve a request
- **Traffic -** How much demand is placed on your system
- **Errors -** Rate of requests that are failing
- **Saturation -** How "full" your system is

[Here's an example from Grafana Play](https://play.grafana.org/d/000000109/the-four-golden-signals?orgId=1).
