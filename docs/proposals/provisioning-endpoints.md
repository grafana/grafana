# Provisioning Endpoints Proposal (Draft)

## Problem

Provisioning in Grafana currently requires editing YAML/JSON files and restarting the server.  
This makes it difficult to automate per-organization provisioning through APIs.

## Proposed Solution

Add a new API endpoint for dynamic provisioning:

```http
POST /apis/provisioning.grafana.app/v1beta/namespaces/:org/provisioning
```

### Example Request

```bash
curl -X POST http://grafana.local/apis/provisioning.grafana.app/v1beta/namespaces/default/provisioning \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "type": "datasource",
        "title": "Prometheus",
        "url": "http://localhost:9090"
      }'
```

### Example Response

```json
{
  "id": "cfg-12345",
  "status": "applied"
}
```

_Status code: 201 Created_

## Why

- Enables automation via API (no restarts required).
- Simplifies multi-org provisioning.
- Aligns with modern CI/CD and GitOps workflows.

## Open Questions

1. Persist configs to files or another store?
2. Reload behavior: synchronous (`201`) or async (`202`)?
3. Expected idempotency for repeated requests?
4. Preferred response fields (`id`, `status`)?
