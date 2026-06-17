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
  - ../../../../developers/http_api/authentication/ # /docs/grafana/next/developers/http_api/authentication/
  - ../../../developer-resources/api-reference/http-api/api-legacy/authentication/ #legacy folder
---

# Authentication options for the HTTP APIs 



## Authentication options for the HTTP API for Grafana OSS

You can authenticate HTTP API requests using basic authentication or a service account token.

### Basic auth

If basic auth is enabled (it is enabled by default), then you can authenticate your HTTP request via
standard basic auth. Basic auth will also authenticate LDAP users.

curl example:

```bash
curl http://admin:admin@localhost:3000/api/org
{"id":1,"name":"Main Org."}
```

### Service account token

To create a service account token, click on **Administration** in the left-side menu, click **Users and access**, then **Service Accounts**.
For more information on how to use service account tokens, refer to the [Service Accounts](/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/) documentation.

You use the token in all requests in the `Authorization` header, like this:

**Example**:

```http
GET http://your.grafana.com/api/dashboards/db/mydash HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

The `Authorization` header value should be _`Bearer <YOUR_SERVICE_ACCOUNT_TOKEN>`_.

## Authentication options for the HTTP API in Grafana Cloud


