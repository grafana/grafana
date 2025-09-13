# Provisioning endpoints (Draft)

**Status:** Draft  
**Related issue:** [#110306](https://github.com/grafana/grafana/issues/110306)

## Summary
Provisioning in Grafana today requires editing YAML/JSON files and restarting the server.  
This creates friction for automation, especially in multi-org environments.  

This proposal suggests introducing a per-organization provisioning API so that provisioning can be managed programmatically via HTTP, without restarts.

## Goals
- Allow org admins to create and update provisioning resources via API.  
- Support common provisioning types: datasources, dashboards, repo configs.  
- Provide validation, idempotency, and secure access.  

## Non-goals
- Fully replacing file-based provisioning in the first iteration.  
- Rewriting the existing provisioning file parser.  

## Proposed API

**POST** `/apis/provisioning.grafana.app/v1beta/namespaces/:org/provisioning`

### Example request
```bash
curl -X POST http://grafana.local/apis/provisioning.grafana.app/v1beta/namespaces/default/provisioning \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "type": "datasource",
        "name": "prometheus",
        "config": {
          "url": "http://localhost:9090",
          "access": "proxy"
        }
      }'
```

### Example success response

```json
{
  "id": "cfg-123",
  "status": "applied"
}
```
**Status codes:**

- `201 Created` – applied successfully
- `202 Accepted` – async apply in progress
- `400` – validation error
- `401` – unauthenticated
- `403` – not authorized
- `409` – conflict
- `500` – server error

## Auth & Permissions

- Only org-admin tokens can call this API.
- All requests should be logged for auditing.

## Storage & Behavior

- **Preferred**: persist configs in the database and apply through a reconciler.
- **Optional**: write configs to provisioning files for backward compatibility.

## Idempotency

- Repeated submissions of the same payload should not create duplicates.
- Support for client-provided `idempotency-key` is recommended.

## Apply semantics

- Default: synchronous (`201 Created`).
- For longer operations: async apply (`202 Accepted`) + status endpoint:  
  `GET /apis/provisioning.grafana.app/v1beta/namespaces/:org/provisioning/:id/status`

## Validation & Schema

- Each provisioning type should have a JSON schema.
- APIs should be versioned (`v1beta` → `v1`).

## Open Questions

1. Should the default apply be synchronous or async?
2. How to merge/override file-based configs?
3. Should scope start small (datasources only) or include dashboards/settings?

## Next steps
- Gather feedback from maintainers on API scope and storage approach.  
- Decide on sync vs async apply as the default.  
- Prototype handler + validation + tests.

