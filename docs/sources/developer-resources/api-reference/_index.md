---
keywords:
  - grafana
  - documentation
  - developers
  - resources
  - data model
title: Grafana APIs
weight: 300
cards:
  items:
    - title: HTTP API
      height: 24
      href: ./http-api/
      description: Every Grafana instance exposes an HTTP API, which is the same API used by the Grafana frontend to manage resources like saving dashboards, creating users, updating data sources, deleting alerts, and more. You can use the HTTP API to programmatically access or manage resources from your Grafana instance.
    - title: Grafana Cloud API
      height: 24
      href: ./cloud-api/
      description: The Grafana Cloud API, sometimes referred to as the Grafana.com API or GCOM API, allows you to interact with resources from your Grafana Cloud Stack programmatically.
    - title: Tracing API
      height: 24
      href: ./tracing-api/
      description: Tempo exposes an API for pushing and querying traces, and operating the cluster itself.
    - title: Synthetic Monitoring API
      height: 24
      href: ./synthetic-monitoring-api/
      description: The Grafana Cloud Synthetic Monitoring REST API provides programmatic access to Synthetic Monitoring resources.
---

# Grafana APIs

Grafana APIs allow you to interact with resources from your Grafana on-prem instance or Cloud Stack programmatically.

Refer to the following API reference guides:

{{< card-grid key="cards" type="simple" >}}

## API rate limits

Grafana APIs don't have a single global API rate limit. This is because Grafana is not a single API surface, but rather a combination of multiple systems such as OSS backends (Mimir, Loki, Tempo), a SaaS control plane (for Grafana Cloud), hosted Grafana instances (for Grafana on-prem), and multiple gateways and edge layers.

### How are limits calculated?

Limits depend on the specific API and product, and are enforced at different layers, including backend services and gateway infrastructure. Most limits are not simple request-per-second limits, but are based on ingestion rate, query complexity, or general resource usage, and are configured per tenant.

### Available limits

In general rate-limits are handled at the gateway and are based on User-Agent, IP, or session cookie. In most cases Grafana enforces a maximum of 100 requests per second with a 1,000 of burst. Moreover, these limits usually scale with the number of gateway replicas, so a cluster running 10–15 replicas can effectively handle significantly higher aggregate throughput.

{{< admonition type="note" >}}

**If you encounter rate limiting, contact Support to verify the specific API or service you're using**, as limits vary and may be adjusted per environment.

{{< /admonition >}}

Known limits include:

- `/api/annotations` - 1 request / second / Grafana replica
