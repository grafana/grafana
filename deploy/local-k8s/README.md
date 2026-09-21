# Run Error Tracking locally

Use Compose for development and kind for Kubernetes acceptance. Both workflows run `error-tracking-api:local`, the app-owned `migrate` command, PostgreSQL, the native signer, AuthZ, and Grafana aggregation.

## Build the API

From the repository root:

```sh
docker build --platform=linux/arm64 -f apps/errortracking/Dockerfile \
  -t error-tracking-api:local .
```

Use `linux/amd64` for an AMD64 kind node. The local workflows require Docker, kubectl, kind, Python 3, OpenSSL, a Grafana Enterprise source checkout in `ENTERPRISE_SOURCE`, and these development images:

- `error-tracking-platform:local` for Grafana and AuthZ, built from this branch with the matching Enterprise source so it contains the current Error Tracking roles and AuthZ mapping
- `error-tracking-auth-signer:local` for signed App Platform identity

Build the platform image from the Grafana root after following the Enterprise checkout's build prerequisites:

```sh
make build-docker-full WIRE_TAGS=enterprise GO_BUILD_TAGS=enterprise
docker tag grafana/grafana:dev error-tracking-platform:local
```

The Grafana target produces `grafana/grafana:dev`; the second command gives the local workflows their expected tag.

Build the signer from that source checkout:

```sh
docker build --platform linux/arm64 -t error-tracking-auth-signer:local \
  "$ENTERPRISE_SOURCE/src/devenv/blocks/auth/signer"
```

The native proof also reads the existing `mt-db.yaml` and `authz-service.yaml` development manifests from `ENTERPRISE_SOURCE`; it does not copy or maintain another version of them here. With Docker limited to 8 GiB, stop Compose before running the kind proof. `docker compose down` preserves its volumes.

## Compose development

```sh
deploy/local-compose/setup.sh
docker compose --env-file .local-compose/generated/.env \
  -f deploy/local-compose/compose.yaml up -d
```

Open `http://localhost:3301/error-tracking` and sign in with the disposable `admin/admin` account. The API listens on `https://localhost:6443`. All published ports bind to loopback.

If mise is installed, use `mise run error-tracking-compose-up` and `mise run error-tracking-compose-down`. Otherwise stop the stack without deleting data:

```sh
docker compose --env-file .local-compose/generated/.env \
  -f deploy/local-compose/compose.yaml down
```

Setup writes ignored configuration under `.local-compose/generated` and preserves passwords and certificates on repeated runs. Named volumes retain PostgreSQL, Grafana metadata, and signer keys. Certificates last 30 days; stop Compose, remove only `.local-compose/generated/certs`, and rerun setup to renew them. Keep the signer-key volume because Grafana may cache signed identity tokens.
