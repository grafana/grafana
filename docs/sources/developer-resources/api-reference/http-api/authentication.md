---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/authentication/
description: 'You can authenticate HTTP API requests using basic authentication or a service account token.'
keywords:
  - grafana
  - http
  - documentation
  - api
  - role-based-access-control
  - acl
  - enterprise
labels:
  products:
    - enterprise
    - oss
title: Authentication options for the HTTP API
menuTitle: Authentication
weight: 03
aliases:
  - ../../../../developers/http_api/authentication/ # /docs/grafana/next/developers/http_api/authentication/
  - ../../../developer-resources/api-reference/http-api/api-legacy/authentication/ #legacy folder
---

# Authentication options for the HTTP APIs

Authentication options depend on whether you're using [Grafana on prem](#authentication-options-in-grafana-ossenterprise) or [Grafana Cloud](#authentication-options-in-grafana-cloud).

To set up organizations, refer to the [X-Grafana-Org-Id header](#the-x-grafana-org-id-header) section.

## Authentication options in Grafana OSS/Enterprise

You can authenticate HTTP API requests using basic authentication or a service account token.

### Basic auth

This option is available in Grafana on prem only.

Basic auth is enabled by default and allows you authenticate your HTTP request via standard basic auth. Basic auth also authenticates LDAP users.

For example:

```bash
curl http://admin:admin@localhost:3000/api/org
{"id":1,"name":"Main Org."}
```

### Service account token

To create a service account token:

1. Go to **Administration** in the left-side menu
1. Click **Users and access > Service Accounts**.

For more information on how to use service account tokens, refer to the [Service Accounts](/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/) documentation.

You use the token in all requests in the `Authorization` header, for example:

```http
GET http://your.grafana.com/api/dashboards/db/mydash HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

The `Authorization` header value should be _`Bearer <YOUR_SERVICE_ACCOUNT_TOKEN>`_.

## Authentication options in Grafana Cloud

To use the HTTP API provided by a Grafana Cloud instance, authenticate requests with a service account token.

To access or create your service account tokens:

1. Go to **Administration** in the left-side menu
1. Click **Users and access > Service Accounts**.

For details on creating service accounts, assigning permissions, and adding tokens, refer to [Service Accounts](/docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/).

Include the service account token in the `Authorization` header for all requests to your Grafana instance:

```http
GET http://your.grafana.com/api/dashboards/db/mydash HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

Requests to the HTTP API are authenticated using the `Authorization` header:

```bash
Authorization: Bearer <SERVICE ACCOUNT TOKEN>
```

## The X-Grafana-Org-Id header

**X-Grafana-Org-Id** is an optional property that specifies the organization to which the action is applied. If not set, the created key belongs to the current context org. Use this header in all requests except those regarding admin.

**Example Request**:

```http
GET /api/org/ HTTP/1.1
Accept: application/json
Content-Type: application/json
X-Grafana-Org-Id: 2
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```
