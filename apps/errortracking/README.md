# Error tracking backend

This module builds the standalone Error Tracking App Platform API. The `error-tracking` executable provides two commands:

- `serve --config=/etc/error-tracking/config.json` runs the HTTPS API server.
- `migrate` applies the application-owned PostgreSQL schema and grants the restricted runtime role.

The API group is `error-tracking.grafana.app/v0alpha1`. Its namespaced `/events` routes verify the signed caller identity, service permission and tenant. Database reads and writes use that verified tenant. Anonymous requests, forged identities and requests for another tenant are rejected. The MVP has no finer product roles.

The JSON config contains HTTPS, signing-key URL, issuer, connection-pool and audit settings. Database credentials use `ERROR_TRACKING_DATABASE_URL` or standard PostgreSQL `PG*` variables. `ERROR_TRACKING_DATABASE_MAX_CONNS` overrides the JSON pool limit. The same executable runs in every environment; configuration supplies its endpoints and credentials.

`migrate` requires a dedicated application database and an existing role named by `ERROR_TRACKING_RUNTIME_ROLE`. It owns the event schema and migration ledger and grants only the runtime privileges. It does not create users or rotate passwords. Startup and readiness require the current migration; liveness checks the process.

## Build and test

The module builds independently of Grafana's root Go workspace:

```sh
cd apps/errortracking
GOWORK=off CGO_ENABLED=0 go test ./...
GOWORK=off CGO_ENABLED=0 go build ./cmd/error-tracking

docker build -t error-tracking-api:local .
```

See the [local run guide](../../deploy/local-k8s/README.md) for Compose development and native Kubernetes verification. Both workflows use this API image, PostgreSQL and Grafana's native API routing. A local test signer supplies platform identities.
