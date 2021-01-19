# Postgres with TLS support

## Start the container:
```bash
$ cd <grafana repo>
$ make devenv sources=postgres_ssl
```

## Client configuration:
After starting grafana a provisioned datasource `postgres-cert` will be created automatically.