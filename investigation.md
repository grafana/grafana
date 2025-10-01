How to reproduce

Setup of initial state

Setup postgres

Edit `devenv/docker/blocks/postgres/.env`:

```bash
postgres_version=17-alpine
```

```bash
make devenv sources="postgres"
```

Setup grafana w. 10.4.6
git checkout v10.4.x <-- run `./dev.sh`



```bash
docker exec -i devenv-postgres-1 pg_restore -U grafana -d grafana --no-owner --no-privileges < db_grafana_68da3581157a57cbed2311c0.dump.txt
```

The dump may reference Azure-specific extensions that aren't available locally:
ERROR:  extension "azure" is not available
So it says that azure is not available; which is fine.
