# gdev Gitea bootstrap

Example `[provisioning] bootstrap_path` directory that declares **Git Sync** against the Gitea in
[`devenv/docker/blocks/gitea`](../docker/blocks/gitea/README.md). Grafana registers a local
repository named `bootstrap` over this directory at startup, and the `repository.json` here is
provisioned like any other resource — the instance configuring its own Git Sync from disk.

For the same mechanism with nothing external to set up, see
[`devenv/provisioning-bootstrap`](../provisioning-bootstrap/README.md).

```bash
make devenv sources=gitea
cd devenv && ./setup.sh provisioning-gitea
cd .. && make run
```

Then open **Administration → Provisioning**. Two repositories are listed: `bootstrap` (this
directory) and `gdev Gitea` (the Git one it declared). The seeded dashboards land in a `gdev Gitea`
folder, which the sync creates from the repository's title.

| What         | Where                                                  |
| ------------ | ------------------------------------------------------ |
| Gitea UI     | <http://localhost:3002> (`grafana` / `grafana-devenv`) |
| Repository   | <http://localhost:3002/grafana/devenv>                 |
| Seed content | `devenv/docker/blocks/gitea/repo`                      |

## Instance-wide effects

Two of the three the bootstrap example lists apply here as well; library panel storage is left
alone.

- **`devenv/datasources.yaml` is linked**, not just `gdev-testdata`: Grafana deletes the
  datasources in its `deleteDatasources` list, overwrites same-named ones, and sets the instance
  default. `undev` unlinks the file but cannot undo those database changes.
- **The default org must be org 1.** `datasources.yaml` sets no `orgId` so `gdev-testdata` is
  always created in org 1, while the repository follows `auto_assign_org_id`. Setup refuses a
  mismatch when it can see one.

## What it declares

`repository.json` — a `git` repository on `http://localhost:3002/grafana/devenv.git`, branch
`main`, syncing into a folder every 10 seconds, with the `branch` and `write` workflows. The token
is the seeded user's password, carried as a secure value.

## Cleanup

`./setup.sh undev` unlinks `conf/custom.ini` in one step — unlike the bootstrap example, nothing
here needs the settings to stay. Restart Grafana afterwards: clearing `bootstrap_path` is what
deletes the `bootstrap` repository, the `gdev Gitea` repository it declared, and everything that
repository synced. The files in Gitea are untouched.

## Notes

- Only one `bootstrap_path` can be set at a time, so this and `devenv/provisioning-bootstrap` are
  mutually exclusive. Setup refuses to switch between them; run `./setup.sh undev` first.
- The repository is unhealthy until Gitea is up, and recovers on its own once the container has
  finished seeding — its log ends on `[gitea-seed] ready`.
- Plain `git` has no webhooks, so pushes arrive on the next poll. `intervalSeconds` sits at the
  10-second minimum to keep that short.
- Writing a dashboard in Grafana commits it back to Gitea. The `branch` workflow works too, but
  plain `git` cannot open pull requests, so a branch is all you get.
