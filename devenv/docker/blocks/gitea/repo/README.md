# gdev Gitea

Synced from the devenv Gitea by the `gitea` repository, so editing these dashboards commits the
files back. Pushing to <http://localhost:3002/grafana/devenv> shows up on the next poll.

- **Random walk** — testdata random walk, at the repository root.
- **Notes** — a nested folder, to show the sync builds the whole tree.

The seed content lives in `devenv/docker/blocks/gitea/repo`; `make devenv-down` and a fresh
`make devenv sources=gitea` restores it.
