+++
title = "Service account HTTP API"
description = "Grafana Service account HTTP API"
keywords = ["grafana", "http", "documentation", "api", "service account"]
aliases = ["/docs/grafana/latest/http_api/serviceaccount/"]
+++

# Service account API

This API allows you to interact programmatically with the [Service accounts]({{< relref "../manage-users/serviceaccount/_index.md" >}}).

**> Note:** If you are using Grafana Enterprise and have [Fine-grained access control]({{< relref "../enterprise/access-control/_index.md" >}}) enabled, for some endpoints you need to have relevant permissions. Refer to specific resources to understand what permissions are required.

## Delete a service account

`DELETE /api/serviceaccounts/:serviceaccountId`

#### Required permissions

For details, see the [introduction]({{< ref "#user-api" >}}).

| Action                 | Scope              |
| ---------------------- | ------------------ |
| serviceaccounts:delete | serviceaccounts:\* |

Deletes the given service account if it exists.

**Example request**:

```http
DELETE /api/serviceaccounts/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Service account deleted"}
```
