---
aliases:
  - /docs/grafana/latest/auth/secretscan/
  - /docs/grafana/latest/setup-grafana/configure-security/secretscan/
description: Grafana token checking
title: Token secret check
weight: 1000
---

# Token secret checking

Grafana allows you to check if your [API keys]({{< relref "../../administration/api-keys/" >}})
and [Service accounts]({{< relref "../../administration/service-accounts/" >}}) are leaked in GitHub through
the [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning) service.

<div class="clearfix"></div>

## Token Revocation

When a Grafana secret is detected by GitHub Secret Scanning, its hash is stored in Grafana's secret check service.

On-premises and cloud Grafana instances can query this service to check if a token emitted by the instance has been publicly exposed by
hash-to-hash comparison.

When a token is found to be leaked, the service will automatically revoke the token, rendering it unusable.

### Outgoing webhook

By default, when a token leak is found, the service will automatically revoke the token and log the event.
Additionally, the service can be configured to send an outgoing webhook notification to a webhook URL.

This notification will contain a JSON payload with the following data:

```json
{
  "alert_uid": "c9ce50a1-d66b-45e4-9b5d-175766cfc026",
  "image_url": "https://images.pexels.com/photos/5119737/pexels-photo-5119737.jpeg?auto=compress&cs=tinysrgb&w=300",
  "link_to_upstream_details": <URL to token leak>,
  "message": "Token of type grafana_service_account_token with name
sa-the-toucans has been publicly exposed in <URL to token leak>.
Grafana has revoked this token",
  "state": "alerting",
  "title": "Toucan Alert: Grafana Token leaked"
}
```

## Configuration

> **Note:** The secretscan feature is disabled by default.

```ini
[secretscan]
# Enable secretscan feature
enabled = false

# Interval to check for token leaks
interval = 5m

# base URL of the grafana token secret check service
base_url = http://127.0.0.1:3333 # TODO: change this to the correct url

# URL to send outgoing webhooks to in case of detection
oncall_url =
```
