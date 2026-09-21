# Error tracking backend

This module builds the standalone Error Tracking App Platform API. The `error-tracking` executable provides two commands:

- `serve --config=/etc/error-tracking/config.json` runs the HTTPS API server.
- `migrate` applies the application-owned PostgreSQL schema and grants the restricted runtime role.

The API group is `error-tracking.grafana.app/v0alpha1`. Its namespaced `/events` routes use signed identity for tenant and user attribution, then enforce tenant, service, and delegated user permissions through AuthZ. Anonymous, cross-tenant, and unauthorized requests are rejected.

The JSON config contains non-secret HTTPS, signing-key, AuthZ, token-exchange, connection-pool, and audit settings. Database credentials use `ERROR_TRACKING_DATABASE_URL` or standard PostgreSQL `PG*` variables. `ERROR_TRACKING_DATABASE_MAX_CONNS` overrides the JSON pool limit. Tokens and credentials remain in mounted secrets.

`migrate` requires a dedicated application database and an existing role named by `ERROR_TRACKING_RUNTIME_ROLE`. It owns the event schema and migration ledger and grants only the runtime privileges. It does not create users or rotate passwords. Startup and readiness require the current migration; liveness checks the process.

## Build and test

The module builds independently of Grafana's root Go workspace:

```sh
cd apps/errortracking
GOWORK=off CGO_ENABLED=0 go test ./...
GOWORK=off CGO_ENABLED=0 go build ./cmd/error-tracking

docker build --platform=linux/arm64 -t error-tracking-api:local .
```

See the [local run guide](../../deploy/local-k8s/README.md) for Compose development and native Kubernetes acceptance. Both workflows run this image with the same signer, AuthZ, and Grafana aggregation path.
