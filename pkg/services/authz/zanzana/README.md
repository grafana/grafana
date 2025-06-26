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
http_addr = 127.0.0.1:8080

[grpc_server]
enabled = true
address = 127.0.0.1:10000
```

And then run grafana server target:

```bash
./bin/darwin-arm64/grafana server target
```

### Using OpenFGA CLI

useful info on how to setup and use https://openfga.dev/docs/getting-started/cli
Once the server is running, you can interact with it using the OpenFGA CLI:

```bash
# List all stores
fga store list

# Other commands
fga model read
fga tuple list
```
