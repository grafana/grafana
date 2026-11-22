# Gitea

A Git server for developing Git Sync locally, seeded with a repository of Grafana resources.

```bash
make devenv sources=gitea
```

| What       | Value                                                    |
| ---------- | -------------------------------------------------------- |
| Web UI     | <http://localhost:3002>                                  |
| Repository | <http://localhost:3002/grafana/devenv> (branch `main`)   |
| Clone URL  | `http://localhost:3002/grafana/devenv.git`               |
| User       | `grafana` / `grafana-devenv` (also the repository token) |

`seed.sh` runs inside the container alongside the server: it waits for the API, creates the user
and the repository, and pushes [`repo/`](repo) as the first commit. Follow it with
`docker logs -f devenv-gitea-1`; it ends on `[gitea-seed] ready`.

To point Grafana at it, see
[`devenv/provisioning-gitea`](../../../provisioning-gitea/README.md), which declares the
repository through `[provisioning] bootstrap_path`:

```bash
cd devenv && ./setup.sh provisioning-gitea && cd .. && make run
```

## Notes

- Seeding is skipped when the repository already exists, so a restart keeps what you committed.
  `make devenv-down` drops the container and its data, and the next run seeds `repo/` afresh.
- The repository is public; the token is only needed for writes.
- Pin another version with `make devenv sources=gitea gitea_version=1.25`.
