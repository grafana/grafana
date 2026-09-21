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

## Native Kubernetes acceptance

The proof creates or reuses only its named local kind cluster. Every Kubernetes command uses the supplied kubeconfig and explicit local context.

```sh
ENTERPRISE_SOURCE=/path/to/grafana-enterprise \
PLATFORM_IMAGE=error-tracking-platform:local \
API_IMAGE=error-tracking-api:local \
KUBECONFIG=/tmp/error-tracking-native.kubeconfig \
  deploy/local-k8s/prove-native.sh
```

The proof runs two Grafana stacks, two API replicas, PostgreSQL with persistent storage, a migration Job, the signer, AuthZ, and its metadata database. It verifies authenticated reads and writes, tenant isolation, Viewer read-only access, discovery and OpenAPI, rejection of anonymous, wrong-audience, and cross-stack requests, metadata-only audit output, replica and complete API outage recovery, database readiness, persistence, credential rotation, and restricted runtime SQL privileges. Grafana pods do not receive event-database credentials.

To inspect the UI:

```sh
kubectl --kubeconfig /tmp/error-tracking-native.kubeconfig \
  --context kind-error-tracking-native -n error-tracking \
  port-forward service/st-grafana-11 3000:3000
```

Open `http://localhost:3000/error-tracking`.
