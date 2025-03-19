---
headless: true
comments: |
  This file is used in the following files: developers/http_api/{_index.md,authentication.md}
---

You can authenticate HTTP API requests using basic authentication, a service account token, or a session cookie (acquired via regular login or OAuth).

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
