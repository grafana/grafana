# Secrets Test Data

Seeds the Secrets API with test keepers and secure values for local development.

## Quick Start

```bash
# 1. Start Grafana with enterprise and feature flags
make enterprise-dev
GF_FEATURE_TOGGLES_ENABLE=secretsManagementAppPlatformUI,secretsManagementAppPlatform,secretsKeeperUI make run

# 2. Seed test data
cd devenv/secrets && go run secrets.go
```

The script creates keepers and secure values via Grafana's HTTP API. Resources are
prefixed with `gdev-` so they can be cleanly removed later.

## Usage

```bash
go run secrets.go                    # Seed from secrets-config.yaml
go run secrets.go -generate 50       # Generate 50 keepers + 50 secrets for load testing
go run secrets.go -clean             # Remove all gdev- prefixed resources
go run secrets.go -test              # Run built-in self-tests (no server required)
go run secrets.go -help              # Show all flags
```

## What Gets Created

**Keepers:**

| Name                | Type | Region    |
| ------------------- | ---- | --------- |
| gdev-aws-production | AWS  | us-east-1 |
| gdev-aws-staging    | AWS  | eu-west-1 |

**Secure Values:**

| Name                   | Description                         |
| ---------------------- | ----------------------------------- |
| gdev-database-password | Production database password        |
| gdev-api-key           | External monitoring service API key |

## Configuration

Edit `secrets-config.yaml` to add or modify test data. The keeper config structure
mirrors the backend Go types at `apps/secret/pkg/apis/secret/v1beta1/keeper_spec_gen.go`.

```yaml
keepers:
  my-keeper:
    description: My test keeper
    aws:
      region: us-west-2
      assumeRoleArn: arn:aws:iam::123:role/test
      externalID: my-external-id

secureValues:
  my-secret:
    description: A test secret
    value: super-secret
    decrypters:
      - secrets-manager-testing
    labels:
      env: test
```

Every keeper must have a provider config (e.g., `aws`).
The "system" keeper type is built-in and cannot be created via the API.

## Environment Variables

| Variable            | Default                 | Description      |
| ------------------- | ----------------------- | ---------------- |
| `GRAFANA_URL`       | `http://localhost:3000` | Grafana base URL |
| `GRAFANA_USER`      | `admin`                 | Grafana username |
| `GRAFANA_PASSWORD`  | `admin`                 | Grafana password |
| `GRAFANA_NAMESPACE` | `default`               | K8s namespace    |

## Troubleshooting

### "Could not reach Grafana"

Make sure Grafana is running. The script connects to `http://localhost:3000` by default.

### "Secrets API not found (HTTP 404)"

The Grafana server is running but the Secrets API is not available. This can happen if
`make run` was started without the required feature flags, or if the secrets API server
needs to be started separately.

If `make run` alone doesn't start the API server, you can run it manually:

```bash
# Start the database
make devenv sources="mt-db"

# Start the API server
CFG_secret_key__v1__secret_key=hunter2 go run -tags "enterprise" ./pkg/cmd/grafana apiserver \
  --skip-auth=true \
  --runtime-config secret.grafana.app/v1beta1=true \
  --secure-port=6443 \
  --database.servers="default=superuser:password@tcp(localhost:13306)/secret_grafana_app" \
  --database.max_idle_conn=5 \
  --database.max_open_conn=5 \
  --database.conn_max_lifetime=14400 \
  --grafana.secrets-manager.encryption.provider=secret_key.v1
```

For more advanced setups (auth, port-forwarding, gRPC), see:
`grafana-enterprise/src/pkg/extensions/apiserver/dev-docs/secrets.md`

### "Authentication failed (HTTP 401/403)"

Check that `GRAFANA_USER` and `GRAFANA_PASSWORD` are correct (defaults: admin/admin),
and that the user has the "Secrets Manager" role in Administration > Users.
