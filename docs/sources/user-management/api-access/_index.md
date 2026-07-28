---
labels:
  products:
    - enterprise
    - oss
    - cloud
title: API access
menuTitle: API access
description: Authenticate automated workloads and scripts against the Grafana HTTP API using service account tokens or Grafana Cloud Access Policies.
keywords:
  - API
  - service accounts
  - tokens
  - API keys
  - access policies
weight: 400
---

# API access

Use service account tokens to authenticate non-human workloads — such as Terraform, CI/CD pipelines, or reporting scripts — against the Grafana HTTP API.

## Choose the right method

| Scenario                                                        | Recommended method                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Grafana HTTP API (self-hosted or Cloud-hosted Grafana)          | [Service account token](../user-identity/service-accounts/)                                                                          |
| Grafana Cloud data plane APIs (metrics, logs, traces, profiles) | [Grafana Cloud Access Policies](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/) |
| Legacy automation using API keys                                | [Migrate to service accounts](../user-identity/service-accounts/migrate-api-keys/)                                                   |

## Service account tokens

[Service accounts](../user-identity/service-accounts/) are the primary way to authenticate applications with the Grafana HTTP API. Create a service account, assign it a role, and generate a token.

Service account tokens inherit permissions from the service account. You can create multiple tokens per service account — for example, to separate audit trails for different applications or to rotate compromised tokens.

## Grafana Cloud Access Policies

For Grafana Cloud data plane APIs (Mimir, Loki, Tempo, Pyroscope), use [Grafana Cloud Access Policies](/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/) to issue scoped tokens.
