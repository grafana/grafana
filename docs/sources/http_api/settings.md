+++
title = "Settings API"
description = "Enterprise Settings HTTP API"
keywords = ["grafana", "http", "documentation", "api", "settings", "enterprise"]
aliases = ["/docs/grafana/latest/http_api/settings/"]
+++

# Enterprise Settings API

Settings API is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "../enterprise" >}}).

## Update / remove database settings

> **Note:** Available in Grafana Enterprise v8.0+.

`PUT /api/admin/settings`

Updates / removes and reloads database settings. You must provide either `updates`, `removals` or both.

It currently only supports changes on `auth.saml` section.

**Example request:**

```http
PUT /api/admin/settings
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "updates": {
    "auth.saml": {
      "enabled": "true"
    }
  },
  "removals": {
    "auth.saml": ["single_logout"]
  },
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 32

{
  "message":"Settings updated"
}
```

Status codes:

- **200** - OK
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **500** - Internal Server Error
