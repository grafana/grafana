# Data requests

[BackendSrv](https://grafana.com/docs/grafana/latest/packages_api/runtime/backendsrv) handles all outgoing HTTP requests from Grafana. This document explains the high-level concepts used by `BackendSrv`.

## Request `cancellation`
> **Note:** Data sources can implement their own cancellation concept. This documentation describes the `request cancellation` included in Grafana.

### The challenge
A data request can take a long time to finish. During the time between when a request starts and finishes, the user might change context. For example, the user navigates away or issues the same request again.

If we allow ongoing requests to continue, it might cause unnecessary load on data sources.

Grafana uses a concept referenced as `request cancellation` to cancel any ongoing request that Grafana doesn’t need.

#### Before `Grafana 7.2`
Before Grafana can cancel any data request, Grafana needs to have a way to identify each request. Grafana identifies each request with the property `requestId` [passed as options](https://github.com/grafana/grafana/blob/master/docs/sources/packages_api/runtime/backendsrvrequest.md) when you use [BackendSrv](https://grafana.com/docs/grafana/latest/packages_api/runtime/backendsrv).

The cancellation logic is:
- When an ongoing request discovers that an additional request with the same `requestId` has started, then Grafana will cancel the ongoing request.
- When an ongoing request discovers that the “cancel all requests” `requestId`, then Grafana will cancel the ongoing request.

#### In `Grafana 7.2`
With Grafana 7.2 we introduced an additional way of canceling requests using [RxJs](https://github.com/ReactiveX/rxjs). To support the new cancellation functionality, the data source needs to use the new `fetch` function in [BackendSrv](https://grafana.com/docs/grafana/latest/packages_api/runtime/backendsrv).

Migrating the core data sources to the new `fetch` function [is an ongoing process that you can read about in this issue.](https://github.com/grafana/grafana/issues/27222)


## Request `queue`

### The challenge
Depending on how web browsers implement the `http1.1` protocol, the browser limits the number of concurrent requests to x number of parallel requests. 

On a Grafana instance [that isn’t using HTTP2](https://grafana.com/docs/grafana/latest/administration/configuration/#protocol) the browser will then limit parallel data requests according to the browsers implementation.

Dashboards can have multiple panels, and each panel can issue multiple data requests. If these requests take a long time to finish the browser will then issue `x` number of parallel requests and wait before issuing any additional requests. 

This can become challenging if the user wants to use the Grafana's api to save the dashboard or search for another dashboard during these long running requests because that requires an additional data request. 

The browser will then wait until there are `x - 1` parallel requests before processing the additional request.

#### Before `Grafana 7.2`
Not supported. 

#### In `Grafana 7.2`
Grafana uses a concept referenced as a `request queue` to queue all incoming data requests in order but reserve a spot for a Grafana api request. 

The first implementation of the `request queue` doesn’t take into account what browser the user uses, the limit for parallel data source requests is therefore hard coded to 5.

> **Note:** Grafana instances [configured with HTTP2 ](https://grafana.com/docs/grafana/latest/administration/configuration/#protocol) will have a hard coded limit of 1000.

The `request queue` is not the same as `request cancellation` and should be treated as such, although Grafana intertwines both concepts at a lower level in code. 
