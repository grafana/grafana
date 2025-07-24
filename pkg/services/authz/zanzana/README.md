# Zanzana

Zanzana is authorization server and wrapper around OpenFGA. OpenFGA implements Zanzibar authorization model, which is relation-based access control. But it's pretty flexible, so you can use it for implementing various authorization models.

## Running Zanzana in embedded mode

By default Zanzana runs in the same binary as Grafana, it's called embedded mode. Grafana communicates with Zanzana/OpenFGA via in-proc GRPC. OpenFGA supports several DB types, like MySQL, Postgres, sqlite. Default is sqlite, but since we run Postgres in cloud, this is recommended setup. In case of Postgres and MySQL OpenFGA creates tables in the same database as grafana (default db name is "grafana"). Minimal config for running Zanzana with Postgres is this:

```ini
app_mode = development

[log]
level = info

[feature_toggles]
zanzana = true

[database]
type = postgres
host = 127.0.0.1:5432
name = grafana
user = grafana
password = password
```

To run postgres DB you need to create docker compose file. Switch to the `devenv` directory and run script to create it:

```sh
cd devenv
./create_docker_compose.sh postgres
docker compose up -d
```

or simply `make devenv sources=postgres` from repo root.

Now you can run grafana (from source root directory):

```sh
make run
```

## Instrumentation

It's always good to know what happens inside and have tools to check performance and request path. So it's good idea to instrument grafana instance with metrics and traces. You can do it by running prometheus and tempo in docker and configure grafana to send traces.

To run prometheus and tempo, add it to docker compose file:

```sh
./create_docker_compose.sh postgres, tempo, grafana
```

There're some differences in compose files and some unnecessary blocks, so you can simply copy this docker-compose file:

```yaml
services:
  postgres:
    image: postgres:15.7
    environment:
      POSTGRES_USER: grafana
      POSTGRES_PASSWORD: password
      POSTGRES_DB: grafana
    ports:
      - "5432:5432"
    command: postgres -c log_connections=on -c log_disconnections=on -c log_destination=stderr
    healthcheck:
      test: [ "CMD", "pg_isready", "-q", "-d", "grafana", "-U", "grafana" ]
      timeout: 45s
      interval: 10s
      retries: 10

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - "./dashboards.yaml:/etc/grafana/provisioning/dashboards/dashboards.yaml"
      - "./datasources_docker.yaml:/etc/grafana/provisioning/datasources/datasources.yaml"
    environment:
      GF_RENDERING_SERVER_URL: http://renderer:8081/render
      GF_RENDERING_CALLBACK_URL: http://grafana:3000/

  prometheus:
    image: prom/prometheus:latest
    command:
      - --config.file=/etc/prometheus.yaml
      - --web.enable-remote-write-receiver
      - --enable-feature=exemplar-storage
    volumes:
      - ./docker/blocks/prometheus/prometheus.yml:/etc/prometheus.yaml
    ports:
      - "9090:9090"
    labels:
      namespace: monitoring
    logging:
      driver: loki
      options:
        loki-url: 'http://localhost:3100/api/prom/push'
        labels: namespace

  tempo:
    image: grafana/tempo:latest
    command:
      - --config.file=/etc/tempo.yaml
    volumes:
      - ./docker/blocks/tempo/tempo.yaml:/etc/tempo.yaml
      - ./docker/blocks/tempo/tempo-data:/tmp/tempo
    ports:
      - "14268:14268"  # jaeger ingest
      - "3200:3200"   # tempo
      - "4317:4317"  # otlp grpc
      - "4318:4318"  # otlp http
```

```sh
docker-compose up -d
```

Then you need to configure grafana to send telemetry to Tempo:

```ini
[server]
router_logging = true

[tracing.opentelemetry.otlp]
address = localhost:4317
```

Then start grafana.

In order to use traces, you'll need to create Tempo data source in Grafana. Go to the grafana instance running in docker (http://localhost:3001) and create new Tempo data source with URL `http://tempo:3200`. Now you can use `gdev-prometheus` and `tempo` data sources for building dashboards or looking into metrics/traces in Explore.

## Load testing

For load testing you can use [grafana-api-tests](https://github.com/grafana/grafana-api-tests) repo. Clone it and navigate to `simulation/fake-user-generator` folder. Run `./generateNestedFolders.ts` script to populate data in grafana:

```sh
./generateNestedFolders.ts --scenario medium -v --user admin --password <your_grafana_password>
```

For the load testing run [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and specify desired test:

```sh
GRAFANA_PASSWORD=<password> k6 run loadtest/tests/dashboard_by_uid.js
```

## Running Zanzana standalone server

When running as a standalone server, Grafana communicates with Zanzana via GRPC. It also requires some additional GRPC authentication configuration. So you need to add auth-signer service to your docker compose file:

```yaml
  auth-signer:
    build: ./docker/blocks/auth/signer/.
    ports:
      - "6481:8080"
    volumes:
      - ./docker/blocks/auth/signer/config.yaml:/app/config.yaml
    restart: unless-stopped
```

This service is located in the grafana-enterprise repo, so make sure you have linked enterprise repo:

```sh
# From OSS repo
 make enterprise-to-oss
 docker compose up -d
 ```

Then add grafana configured in client mode to be able to test requests against zanzana server. Unfortunately, due to issue with config implementation, stack id cannot be configured through env variables, so you should create ini file and put it there:

```ini
[environment]
stack_id = 11
```

Then link it to the grafana client. Default stack id is `11` and token is `ThisIsMySecretToken`. Those values configured in `auth-signer` by default, so if you need to change it, follow instructions in [auth signer readme](https://github.com/grafana/grafana-enterprise/blob/main/src/devenv/blocks/auth/signer/README.md)

```yaml
  grafana-client:
    image: grafana/grafana:main
    ports:
      - "3002:3000"
    volumes:
      - "./dashboards.yaml:/etc/grafana/provisioning/dashboards/dashboards.yaml"
      - "./dev-dashboards:/usr/share/grafana/devenv/dev-dashboards"
      - "./datasources_docker.yaml:/etc/grafana/provisioning/datasources/datasources.yaml"
      - "<path_to_grafana_config_file_ini>:/etc/grafana/grafana.ini"
    environment:
      GF_DEFAULT_APP_MODE: development
      GF_LOG_LEVEL: debug
      GF_ENVIRONMENT_STACK_ID: 11
      GF_FEATURE_TOGGLES_ENABLE: zanzana authZGRPCServer unifiedStorage unifiedStorageSearch
      GF_ZANZANA_CLIENT_MODE: client
      GF_ZANZANA_CLIENT_ADDRESS: host.docker.internal:10000
      GF_ZANZANA_CLIENT_TOKEN: ThisIsMySecretToken
      GF_ZANZANA_CLIENT_TOKEN_EXCHANGE_URL: http://host.docker.internal:6481/sign/access-token
```

Run containers:

```sh
 docker compose up -d
 ```

Finally, configure zanzana standalone server (this is your `custom.ini` file in grafana repo):

```ini
app_mode = development

target = zanzana-server

[log]
level = debug

[feature_toggles]
zanzana = true

[zanzana.server]
check_query_cache = true
signing_keys_url = http://localhost:6481/jwks

[grpc_server]
enabled = true
address = 127.0.0.1:10000

[database]
type = postgres
host = 127.0.0.1:5432
name = grafana
user = grafana
password = password

[tracing.opentelemetry.otlp]
address = localhost:4317
```

Now you can run zanzana server:

```sh
make build-go
./bin/<arch>/grafana server target
```

To test everything out, go to grafana client (http://localhost:3002) and open any dashboard. There should be some records in the zanzana server logs

If you want to debug zanzana server, you can run it from VS Code debug panel - select `Run Authz server` target. Make sure that no grafana instances running at port `3001` since it's default port for this debug config (`docker compose stop grafana` if you have grafana running in docker, or remap it to another port).

## Zanzana cli

Zanzana can be run as a standalone OpenFGA HTTP server that allows you to use the OpenFGA CLI to debug and manage fine-grained authorization relationships within Grafana.

To test this you need to run standalone zanzana server. Use following config:

```ini
# ini
app_mode = development
target = zanzana-server

[feature_toggles]
zanzana = true

[zanzana.server]
allow_insecure = true
http_addr = 127.0.0.1:8080

[grpc_server]
enabled = true
address = 127.0.0.1:10000
```

And then run grafana server target:

```bash
./bin/<arch>/grafana server target
```

### Using OpenFGA CLI

There's useful info on how to setup and use [OpenFGA CLI](https://openfga.dev/docs/getting-started/cli). Once the server is running, you can interact with it using the CLI:

```bash
# List all stores
fga store list

# Other commands
fga model list --store-id <store_id>
fga tuple read --store-id <store_id>
fga query check
```
