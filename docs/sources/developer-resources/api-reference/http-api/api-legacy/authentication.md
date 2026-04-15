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
weight: 110
aliases:
  - ../../../developers/http_api/authentication/ # /docs/grafana/next/developers/http_api/authentication/
  - ../../../../developer-resources/api-reference/http-api/api-legacy/authentication/ #legacy folder
---

{{< admonition type="caution" >}}

Starting in Grafana 13, `/api` endpoints are being deprecated. This change doesn't disrupt or break your current setup: legacy APIs are not being disabled and remain fully accessible and operative. However, `/api` routes will no longer be updated and **will be removed in a future major release.**

To learn more refer to the [new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

{{< /admonition >}}

{{< admonition type="note" >}}

To learn about authentication for Grafana APIs refer to [Authenticate HTTP API requests](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/#authenticate-http-api-requests).

{{< /admonition >}}

# Authentication (deprecated)

## Authentication options for the HTTP API for Grafana OSS

{{< docs/shared lookup="developers/authentication.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Authentication options for the HTTP API in Grafana Cloud

{{< docs/shared source="grafana-cloud" lookup="/developer-resources/authentication.md" version="" >}}
