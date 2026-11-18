# Grafana HA with embedded NATS test setup

A docker compose setup that runs three Grafana instances sharing one database, with embedded NATS turned on as described in [Set up NATS for high availability](../../../docs/sources/setup-grafana/set-up-nats-for-high-availability.md).
Use it to try HA watches on the legacy SQL unified-storage backend by hand, the way a self-managed HA cluster runs them.
Refer to the docs page for what each setting does, the port guidance and troubleshooting.

Included services:

- `db`: MySQL 8.4 (default) or Postgres 17, the shared Grafana database.
- `grafana1`, `grafana2`, `grafana3`: Grafana with `[nats] enabled = true`, cluster TLS on the cluster port, and the same Secrets Manager `secret_key`.
- `nginx-proxy`: round-robin reverse proxy in front of the three instances, the only port published on the host.
- `smoke`: the smoke checks in `smoke/main.go`, built and started on demand, see [Smoke test](#smoke-test).

Apart from cluster TLS and `advertise_address`, the instances use the `[nats]` defaults.
They find each other through the shared database and bind the cluster port `6222` on all interfaces.
Each instance advertises its hostname, `grafana1` to `grafana3`, and its certificate is issued for that name.
Without `advertise_address`, an instance advertises the IP address of its network interface, so its certificate would need that IP as a SAN, and Docker assigns container IPs when the network is created and can change them on restart.
The docs page recommends the same for any cluster whose instance IPs change.
Port `6222` is only reachable on the compose network, and the client port `4222` stays closed.
The instances start one after another, because concurrent first-start migrations race on the migration lock.

## Build a Grafana image

Build an image from the branch you want to test:

```bash
cd <grafana repo>
make build-docker-full
```

This tags `grafana/grafana-oss:dev`.
On Apple silicon, add `PLATFORM=linux/arm64` to avoid emulating amd64.
To test a published build instead, set `GRAFANA_IMAGE`, for example `GRAFANA_IMAGE=grafana/grafana-dev:<tag>`.

## Generate certificates

Run this and the following commands from this directory:

```bash
cd devenv/docker/ha-test-nats
./certs/gen-certs.sh
```

This writes a CA, one certificate per instance with its hostname as the SAN, and a "rogue" certificate from a second CA into `certs/out` (gitignored).
Each instance mounts its own directory at `/certs`.
To test certificate rotation, regenerate the certificates while the stack runs: instances pick up changed files within about 15 seconds.

## Start

```bash
docker compose up -d --wait
```

Browse Grafana at http://localhost:3000 (admin/admin).

Settings, all optional, read from the environment or a `.env` file next to `docker-compose.yaml`:

| Variable                     | Default                   | Purpose                                                                                           |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `GRAFANA_IMAGE`              | `grafana/grafana-oss:dev` | Grafana image for all three instances                                                             |
| `GRAFANA_DB`                 | `mysql`                   | `mysql` or `postgres`                                                                             |
| `HTTP_PORT`                  | `3000`                    | Host port for nginx                                                                               |
| `SECRETS_MANAGER_SECRET_KEY` | `ha-test-nats-secret-key` | `[secrets_manager.encryption.secret_key.v1] secret_key`, which encrypts the NATS route credential |

## Smoke test

```bash
docker compose run --rm --build smoke
```

This builds `smoke/main.go` into a small image and runs it on the compose network, so it reaches ports 3000, 6222 and 4222 of every instance without publishing them.
It mounts the Docker socket to kill `grafana1`.

It checks:

- Notifier: every instance registers `grafana_storage_server_sql_watch_missing_events_total`, which the legacy SQL backend registers only with the NATS notifier.
- Discovery: all three instances have a row in `nats_discovery_peers`.
- Routes: `grafana_nats_embedded_server_routes` is 2, the number of instances minus one, on every instance.
- Route credential: one row for it in `secret_encrypted_value`.
- Watch fan-out: a playlist created on `grafana1` arrives as `ADDED` on watches opened on `grafana2` and `grafana3`.
- No polling: right after the watch writes, `grafana_storage_server_poller_query_latency_seconds` has no samples on any instance.
  A polling instance reads `resource_history` before it can deliver a write to its watch, so the check needs no idle window.
- Mutual TLS on port 6222: a TLS connection with the CA and a node certificate gets the NATS route `INFO`; no client certificate, the rogue certificate and a plaintext connection get nothing.
- Client port 4222 is closed on every instance.
- Node loss: after a kill of `grafana1`, `grafana2` and `grafana3` drop to one route, and a surviving peer prunes the row of `grafana1`.
  With the default discovery TTL (15s) and interval (5s), the prune takes at most 21s: the heartbeat is stored in whole seconds, so it goes stale up to TTL plus 1s after the kill, and the next tick of a peer prunes it within one interval.
  The check waits for both conditions for up to 26s, one more interval of margin for a slow or failed prune tick.

It prints `PASS` or `FAIL` per check and exits with the number of failures.
`SKIP_KILL=1` skips the last check, for example `docker compose run --rm -e SKIP_KILL=1 smoke`.
After the kill check, bring the instance back with `docker compose up -d --wait grafana1`.

Use the same `GRAFANA_DB` for the smoke test as for `docker compose up`.

## Stop

```bash
docker compose down
```

The database runs on tmpfs, so `down` discards all data.
